# Shopify Theme Editor — How It Actually Works
## Research Reference for ShopForge

Sources: Shopify developer docs (shopify.dev), Dawn theme GitHub repo, @shopify/theme-sections open-source library, Shopify Partner blog, Shopify Community forums.

---

## What We Are Building (Context)

ShopForge is a high-performance storefront platform meant to compete with Shopify at the rendering layer. Our stack:

- **SSR:** Hono + Eta on Bun/Cloudflare Workers (vs. Shopify's Ruby/Liquid on their own infra)
- **Templates:** Eta template strings compiled once and cached (vs. Liquid files)
- **Layout storage:** Cloudflare KV as flat ordered `sections[]` JSON (vs. Shopify's JSON templates in Git-tracked theme files)
- **Frontend:** Alpine.js + HTMX, no hydration (vs. Shopify's custom JS + React-based Polaris admin)
- **Editor UI:** Next.js builder (Phase 2+)

Understanding exactly how Shopify's editor works is essential for designing ours correctly — and for knowing where we can do better.

---

## 1. Overall Architecture

### The split: iframe + sidebar

Shopify's theme editor is two completely separate UIs:

1. **Admin sidebar** — a React/Polaris web app running at `admin.shopify.com`. This is where merchants see the section list, settings forms, and theme controls.
2. **Storefront iframe** — the *actual* storefront, loaded inside the admin page. The same Liquid renderer that shoppers hit. Not a special editor version — the real thing.

The iframe loads the merchant's live storefront URL (e.g. `mystore.myshopify.com/`) with a special session context that tells the rendering server it is in design mode. The sidebar and the iframe are on different origins, which means postMessage is technically available — but Shopify's primary communication mechanism is not postMessage. It is **CustomEvents dispatched directly into the iframe's document** (more on this in section 4).

### Design mode detection

When Shopify loads the storefront inside the editor iframe, it injects two signals:

**In Liquid (server-side):**
```liquid
{% if request.design_mode %}
  {# This code only runs when rendered inside the editor iframe #}
{% endif %}
```

**In JavaScript (client-side, injected into the iframe):**
```javascript
Shopify.designMode   // true in editor, undefined for shoppers
Shopify.inspectMode  // true when the "Preview inspector" is toggled on
```

Theme developers use `request.design_mode` to conditionally change rendering — e.g. expand accordions by default in the editor so merchants can see content, but collapse them for shoppers.

### Section wrappers — how the editor knows which DOM element is which section

Shopify auto-generates a wrapper `<div>` around every rendered section:

```html
<div
  id="shopify-section-{{ section.id }}"
  class="shopify-section"
  data-section-id="{{ section.id }}"
  data-section-type="{{ section.type }}"
>
  <!-- section Liquid content goes here -->
</div>
```

The editor reads `data-section-id` and `data-section-type` to map DOM elements back to the section configuration in the JSON template.

For **blocks** within a section, developers must manually add the `shopify_attributes` object to the block's parent element in their Liquid template:

```liquid
{% for block in section.blocks %}
  <div {{ block.shopify_attributes }}>
    <!-- This generates: data-block-id="..." data-block-type="..." -->
    {{ block.settings.text }}
  </div>
{% endfor %}
```

**ShopForge equivalent:** We add wrapper divs only when `it.editorMode` is true, using `data-section-id` and `data-section-type` on the same pattern.

---

## 2. How Text / Content Updates Work

### The Section Rendering API

When a merchant changes a text setting in the editor sidebar, Shopify does **not** do a full page reload. Instead it calls the **Section Rendering API** — an AJAX endpoint built into every Shopify storefront.

**Endpoint:**
```
GET /                    ?sections=section-id-1,section-id-2
GET /collections/shoes   ?sections=header-abc,product-grid-xyz
GET /                    ?section_id=single-section-id   (single section, returns HTML directly)
```

**Response (multi-section):**
```json
{
  "header-abc": "<div id=\"shopify-section-header-abc\" class=\"shopify-section\">...rendered HTML...</div>",
  "product-grid-xyz": "<div id=\"shopify-section-product-grid-xyz\" class=\"shopify-section\">...rendered HTML...</div>"
}
```

If a section fails to render or doesn't exist, it returns `null` for that key. The HTTP status is still 200.

**Limitations:**
- Maximum 5 sections per single API call
- You cannot pass overridden setting values via query params — the endpoint uses whatever settings are currently saved for that section. This means the flow is: **save setting first → then call Section Rendering API → then update DOM**.

### The full update cycle for a text change

1. Merchant types new heading text in the sidebar form
2. Editor saves the new value server-side (updates `settings_data.json` / JSON template on Shopify's servers)
3. Editor calls `GET /current-page?sections=affected-section-id`
4. Server re-renders that section with the new setting value
5. Response JSON is received
6. Editor replaces `outerHTML` of the section element in the iframe DOM
7. Editor dispatches `shopify:section:load` CustomEvent into the iframe document so the section's JavaScript re-initializes

```javascript
// Conceptual — what the editor does (simplified from observed behavior)
async function rerenderSection(pageUrl, sectionId) {
  const res  = await fetch(`${pageUrl}?sections=${sectionId}`);
  const data = await res.json();
  const el   = iframe.contentDocument.getElementById(`shopify-section-${sectionId}`);
  el.outerHTML = data[sectionId];

  iframe.contentDocument.dispatchEvent(
    new CustomEvent('shopify:section:load', {
      detail: { sectionId },
      bubbles: true
    })
  );
}
```

### Live preview (no server round-trip) for certain types

For **color**, **range**, and plain **text** settings — if those settings are referenced inside a `{% style %}` tag in Liquid — Shopify's editor can apply the change as a direct CSS custom property injection or text node patch, without any server call:

- **Color/range settings:** Editor injects a CSS variable update directly into the iframe's stylesheet
- **Text settings:** Editor patches the matching text node in the DOM directly

Only if the setting doesn't qualify for live preview does it fall back to the Section Rendering API call.

**ShopForge equivalent:** Our `GET /?sections=section-id` endpoint — Hono detects the `sections` query param, renders only those section IDs with current layout settings, returns `{ "section-id": "<div>...</div>" }`. This is the most critical endpoint for editor performance.

---

## 3. How Style / Color Updates Work

### The `{% style %}` tag — key to live preview

Shopify Liquid has a special `{% style %}` tag. CSS inside this tag is rendered inline in the page's `<head>`, **not** extracted into a static asset file. This is what enables the editor to update styles live.

```liquid
{% style %}
  .section-{{ section.id }} {
    background-color: {{ section.settings.bg_color }};
    color: {{ section.settings.text_color }};
  }
{% endstyle %}
```

Because this CSS is inline in the HTML document (not in a separate `.css` file), the editor can patch it client-side without a server round-trip.

### CSS custom properties — the recommended pattern

Shopify's best practice (used in the Dawn theme) is to emit CSS custom properties via a `{% style %}` block inside `theme.liquid`, and then reference those variables in the external stylesheet:

```liquid
{{! In theme.liquid <head> }}
<style>
  :root {
    --color-primary:   {{ settings.color_primary }};
    --color-secondary: {{ settings.color_secondary }};
    --font-body:       {{ settings.font_body.family }}, {{ settings.font_body.fallback_families }};
    --border-radius:   {{ settings.border_radius }}px;
  }
</style>
```

```css
/* In theme.css (static asset) */
.btn {
  background: var(--color-primary);
  border-radius: var(--border-radius);
}
```

**Critical limitation:** The editor **cannot** provide live preview for settings referenced only inside `/assets/*.css` files. Live preview only works for settings referenced inside `{% style %}` tags in Liquid templates/sections.

### How the editor applies a color change live

When a merchant picks a new brand color:

1. If the color setting is in a `{% style %}` block: editor injects a CSS variable override directly into the iframe. No server call. Instant.
2. If the color setting is only in a static CSS file: falls back to a Section Rendering API call (re-renders the section server-side, swaps DOM).

### The `{% stylesheet %}` tag (different from `{% style %}`)

Sections can include a `{% stylesheet %}` tag. The content is:
- **Concatenated** across all sections into a single `styles.css` file
- **Injected** via `content_for_header`
- **Not** inline — this is a static asset, so **Liquid does not render inside it**

Use `{% style %}` for dynamic, setting-driven CSS. Use `{% stylesheet %}` for static structural CSS.

**ShopForge equivalent:** We use CSS custom properties injected via inline `<style>` in the shell based on `it.theme` (brand_color, border_radius, font_family). When the editor changes a theme setting, we update these vars client-side immediately — no re-render needed.

---

## 4. The CustomEvent System — Editor ↔ Storefront Communication

This is the core of how the editor and the storefront iframe communicate.

### Events the editor fires into the iframe

The editor dispatches these as `CustomEvent` objects directly onto `iframe.contentDocument`. They bubble through the DOM. Theme JavaScript listens on `document`.

| Event | When fired | `event.detail` |
|---|---|---|
| `shopify:section:load` | Section added, or re-rendered after a setting change | `{ sectionId, load }` |
| `shopify:section:unload` | Section removed | `{ sectionId }` |
| `shopify:section:select` | Merchant clicks section in editor sidebar | `{ sectionId, load }` |
| `shopify:section:deselect` | Merchant clicks away from a section | `{ sectionId }` |
| `shopify:section:reorder` | Section dragged to a new position | `{ sectionId }` |
| `shopify:block:select` | Merchant clicks a block within a section | `{ sectionId, blockId, load }` |
| `shopify:block:deselect` | Block deselected | `{ sectionId, blockId }` |
| `shopify:inspector:activate` | Preview inspector turned on | — |
| `shopify:inspector:deactivate` | Preview inspector turned off | — |

All events are non-cancellable and bubble up the DOM.

### How theme JavaScript listens

```javascript
// Vanilla JS — inside the storefront's own JavaScript
document.addEventListener('shopify:section:load', (event) => {
  const sectionId = event.detail.sectionId;
  const sectionEl = document.getElementById(`shopify-section-${sectionId}`);
  initSection(sectionEl); // re-init sliders, carousels, etc.
});

document.addEventListener('shopify:section:unload', (event) => {
  const sectionId = event.detail.sectionId;
  cleanupSection(sectionId); // remove event listeners to prevent leaks
});

document.addEventListener('shopify:section:select', (event) => {
  const sectionEl = document.getElementById(`shopify-section-${event.detail.sectionId}`);
  sectionEl.scrollIntoView({ behavior: 'smooth' });
});

document.addEventListener('shopify:block:select', (event) => {
  const { sectionId, blockId } = event.detail;
  // e.g. scroll a slideshow to the selected slide block
});
```

### @shopify/theme-sections — formalizes the pattern

Shopify open-sourced a library that wraps all the event wiring. Theme developers register a section type with lifecycle hooks:

```javascript
import { register } from '@shopify/theme-sections';

register('slideshow', {
  onLoad()         { this.initSlider(); },
  onUnload()       { this.destroySlider(); },
  onSelect()       { this.pauseAutoplay(); },
  onDeselect()     { this.resumeAutoplay(); },
  onBlockSelect(e) { this.goToSlide(e.detail.blockId); },
  onBlockDeselect(){ /* ... */ },
  onReorder()      { /* ... */ }
});
```

The library handles `document.addEventListener` wiring and maps events to the right section instance automatically.

### The critical memory leak problem — event listener stacking

When `shopify:section:load` fires for a re-render (not just initial load), the old section element is removed from the DOM and a new one is injected. If the section's JavaScript attached event listeners to the old element via closure, those listeners are now orphaned. But if it attached them globally (e.g. `document.addEventListener`), those stale listeners keep firing.

The canonical fix:

```javascript
document.addEventListener('shopify:section:load', (event) => {
  const container = document.getElementById(`shopify-section-${event.detail.sectionId}`);
  // Destroy old instance for this section before creating new one
  if (window.sectionInstances?.[event.detail.sectionId]) {
    window.sectionInstances[event.detail.sectionId].destroy();
  }
  window.sectionInstances = window.sectionInstances || {};
  window.sectionInstances[event.detail.sectionId] = new MySection(container);
});
```

**ShopForge equivalent:** Same pattern. Our `editorMode` flag means we wrap sections in `data-section-id` divs. Our editor fires equivalent CustomEvents when it re-renders a section after a setting change. Alpine components already have their own lifecycle via `x-init` and `$destroy` — we need to ensure these work correctly when HTMX-style partial re-renders happen.

---

## 5. Adding / Removing / Reordering Sections

### Adding a section — full sequence

1. Merchant clicks "Add section" in the editor sidebar
2. Editor shows a **section picker** drawer — lists all sections whose schema has at least one `presets` entry
3. Merchant selects a section type (e.g. "Image with text")
4. Editor writes a new entry into the JSON template's `sections` object and appends its ID to the `order` array — using the preset's default settings and blocks
5. Editor calls the Section Rendering API: `GET /page?sections=new-section-id`
6. Editor injects the rendered HTML at the correct position in the iframe DOM
7. Editor fires `shopify:section:load` → theme JS initializes
8. Editor fires `shopify:section:select` → new section scrolls into view, sidebar shows its settings

No page reload at any point.

### Removing a section — full sequence

1. Merchant clicks the delete icon on a section
2. Editor fires `shopify:section:unload` → theme JS cleans up (removes event listeners, destroys instances)
3. Section element is removed from iframe DOM
4. JSON template `order` array is updated (section ID removed)
5. `sections` object entry for that section is deleted

### Reordering sections — full sequence

1. Merchant drags a section to a new position
2. Section element moves in the iframe DOM (CSS transform or actual DOM move)
3. Editor fires `shopify:section:reorder`
4. JSON template `order` array is re-arranged to match new sequence
5. **No re-render.** The section HTML stays the same — only its position changes.

### JSON template structure (what gets written on add/remove/reorder)

```json
{
  "sections": {
    "hero-123": {
      "type": "hero-banner",
      "settings": {
        "heading": "Summer Sale",
        "overlay_opacity": 40
      },
      "blocks": {
        "btn-1": {
          "type": "button",
          "settings": { "label": "Shop Now", "link": "/collections/all" }
        }
      },
      "block_order": ["btn-1"]
    },
    "grid-456": {
      "type": "product-grid",
      "settings": { "columns": 3, "products_per_page": 8 }
    }
  },
  "order": ["hero-123", "grid-456"]
}
```

This is the direct equivalent of our `sections[]` ordered array in KV. Shopify uses named keys + a separate `order` array; we use a flat ordered array. The semantics are identical.

---

## 6. Block-Level Editing

Blocks are repeatable units **within** a section. Think: slides within a slideshow, buttons within a hero, testimonials within a testimonial section.

### Schema definition

```json
{
  "name": "Slideshow",
  "blocks": [
    {
      "type": "slide",
      "name": "Slide",
      "settings": [
        { "type": "image_picker", "id": "image",    "label": "Image" },
        { "type": "text",         "id": "caption",  "label": "Caption" },
        { "type": "url",          "id": "link",     "label": "Link" }
      ]
    }
  ],
  "max_blocks": 10
}
```

### Block limits

- Default: 50 blocks per section
- Lowered via `max_blocks` in schema
- Per JSON template: up to 1,250 total blocks across all sections
- Nested blocks: up to 8 levels deep

### Accessing blocks in Liquid

```liquid
{% for block in section.blocks %}
  <div class="slide" {{ block.shopify_attributes }}>
    <img src="{{ block.settings.image | img_url: '1200x' }}" alt="{{ block.settings.caption }}">
    <p>{{ block.settings.caption }}</p>
  </div>
{% endfor %}
```

`{{ block.shopify_attributes }}` outputs `data-block-id="..."` — required for the editor to detect which block was clicked.

### Adding / removing blocks

Adding a block fires `shopify:section:load` (the entire section re-renders to include the new block). Removing a block also fires `shopify:section:unload` then `shopify:section:load`. Blocks don't have their own load/unload events — the parent section re-renders.

### Block selection events

```javascript
document.addEventListener('shopify:block:select', (event) => {
  const { sectionId, blockId } = event.detail;
  // e.g. scroll a slideshow to show the selected slide
  goToSlide(blockId);
});

document.addEventListener('shopify:block:deselect', (event) => {
  // e.g. resume autoplay
  resumeAutoplay();
});
```

---

## 7. How Link Interception Works in the Editor

The editor has to prevent `<a>` tags from navigating away — otherwise clicking a product card would load a new page, killing the editor context.

### Shopify's approach — transparent overlay

The editor renders an invisible transparent `<div>` over the top of the entire iframe `<body>`. This overlay:

- **Intercepts all clicks** before they reach the storefront DOM (pointer events hit the overlay first)
- Uses `elementFromPoint(x, y)` on the underlying document to determine which element was actually under the cursor
- Walks up the DOM from that element to find the nearest `[data-section-id]` ancestor
- Fires `shopify:section:select` with that section ID into the iframe document
- Since the overlay intercepted the click, no `<a>` tag ever gets the click event — navigation is blocked entirely

This means **no special link-disabling code is needed in the theme**. The overlay handles everything transparently.

`Shopify.designMode` is provided so theme developers can also conditionally disable their own behaviors (carousels with autoplay, video autoplay) that would be distracting in the editor:

```javascript
if (Shopify.designMode) {
  // Don't autoplay videos in editor
}
```

### Alternative approaches (theme-side, if needed)

```liquid
{% if request.design_mode %}
  {% style %}
    a { pointer-events: none; }
  {% endstyle %}
{% endif %}
```

**ShopForge equivalent:** Same transparent overlay approach. Our editor wraps the storefront iframe and maintains a click interceptor div over the `<body>`. On click, we use `elementFromPoint` on the iframe's document to find the `[data-section-id]`, then open that section's settings form in the sidebar.

---

## 8. Section Schema — Full Reference

Every Liquid section file contains a `{% schema %}` block with valid JSON (no Liquid inside it). This JSON defines the entire editor UI for that section.

```json
{
  "name": "Hero banner",
  "description": "A full-width hero with optional CTA buttons",
  "class": "hero-section",
  "limit": 1,
  "enabled_on": {
    "templates": ["index", "collection"]
  },
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    { "type": "text",         "id": "heading",    "label": "Heading",    "default": "Welcome" },
    { "type": "textarea",     "id": "subheading", "label": "Subheading"  },
    { "type": "image_picker", "id": "image",      "label": "Background image" },
    { "type": "color",        "id": "text_color", "label": "Text color", "default": "#ffffff" },
    { "type": "range",        "id": "overlay",    "label": "Overlay opacity", "min": 0, "max": 100, "step": 5, "default": 40 },
    { "type": "select",       "id": "text_align", "label": "Text alignment",
      "options": [
        { "value": "left",   "label": "Left"   },
        { "value": "center", "label": "Center" },
        { "value": "right",  "label": "Right"  }
      ],
      "default": "center"
    }
  ],
  "blocks": [
    {
      "type": "button",
      "name": "Button",
      "settings": [
        { "type": "text", "id": "label", "label": "Label", "default": "Shop Now" },
        { "type": "url",  "id": "link",  "label": "Link" }
      ]
    }
  ],
  "presets": [
    {
      "name": "Hero banner",
      "category": "Image",
      "blocks": [{ "type": "button" }]
    }
  ],
  "max_blocks": 3
}
```

### All schema attributes

| Attribute | Required | Purpose |
|---|---|---|
| `name` | Yes | Display name in editor sidebar |
| `description` | No | Help text shown under name |
| `class` | No | CSS class added to the auto-generated section wrapper div |
| `limit` | No | Max instances of this section type per page (default: unlimited) |
| `enabled_on` | No | Restricts this section to specific templates/groups |
| `disabled_on` | No | Prevents this section on specific templates/groups |
| `settings` | No | Array of setting inputs shown in editor sidebar |
| `blocks` | No | Block types merchants can add within this section |
| `max_blocks` | No | Max total blocks in this section instance (default: 50) |
| `presets` | No | Pre-configured starting layouts (section must have ≥1 preset to appear in "Add section" picker) |
| `tag` | No | HTML element for the section wrapper (default: `div`) |

### All setting input types

| Type | Output | Use for |
|---|---|---|
| `text` | String | Single-line text (headings, labels) |
| `textarea` | String | Multi-line text (descriptions) |
| `richtext` | HTML string | Formatted text with bold/italic/links |
| `html` | HTML string | Raw HTML block |
| `color` | Hex string `#rrggbb` | Color pickers — supports live preview via `{% style %}` |
| `color_scheme` | Scheme ID | Picks from theme-level color schemes |
| `image_picker` | Image object | Image selector (returns CDN URL via Liquid filters) |
| `video` | Video object | Shopify-hosted video picker |
| `video_url` | URL string | YouTube/Vimeo URL |
| `url` | URL string | Link picker (internal pages, collections, products, or external) |
| `select` | String | Dropdown with predefined options array |
| `radio` | String | Radio buttons |
| `checkbox` | Boolean | True/false toggle |
| `range` | Number | Slider with min/max/step |
| `number` | Number | Number input field |
| `font_picker` | Font object | Google Fonts / system font selector |
| `collection` | Collection object | Store collection picker |
| `collection_list` | Array | Multiple collection picker |
| `product` | Product object | Store product picker |
| `product_list` | Array | Multiple product picker |
| `blog` | Blog object | Blog picker |
| `page` | Page object | Page picker |
| `link_list` | Navigation menu | Navigation menu picker |
| `metaobject` | Metaobject | Shopify Metaobject reference |
| `article` | Article object | Blog post picker |
| `header` | — | Visual divider/header in the sidebar form (no value) |
| `paragraph` | — | Informational text in the sidebar form (no value) |

### Accessing settings in Liquid

```liquid
{{! Section-level settings }}
{{ section.settings.heading }}
{{ section.settings.text_color }}

{{! Block settings within a for loop }}
{% for block in section.blocks %}
  <div {{ block.shopify_attributes }}>
    {{ block.settings.label }}
  </div>
{% endfor %}

{{! Theme-level global settings (from config/settings_schema.json) }}
{{ settings.color_primary }}
{{ settings.font_body | font_face }}
```

---

## 9. How Liquid Code Updates Work

Shopify has two separate paths for changing a theme's code:

### Path A — Visual editor (sidebar)

The editor writes to **JSON template files** and **`settings_data.json`** (not Liquid files). This is the path for:
- Adding/removing/reordering sections
- Changing section settings values
- Adding/removing blocks
- Changing global theme settings

These files are stored in the theme's Git-tracked directory on Shopify's servers. When a merchant publishes, the JSON files go live and subsequent Liquid renders use the updated values.

### Path B — Code editor (`admin/themes/edit`)

A separate part of Shopify admin — not the visual editor. Accessible via **Online Store → Themes → Actions → Edit code**.

**What it does:**
- Shows a file tree of the theme: `layout/`, `templates/`, `sections/`, `snippets/`, `assets/`, `config/`
- Monaco-based code editor for editing raw `.liquid`, `.css`, `.js` files
- Changes are saved via the **Asset REST API** (or GraphQL Admin API, post-April 2025):
  ```
  PUT /admin/api/2024-10/themes/{theme_id}/assets.json
  Body: { "asset": { "key": "sections/hero-banner.liquid", "value": "..." } }
  ```
- Shopify recompiles Liquid on save (validates syntax, invalidates the render cache for that template)
- Changes take effect on the next page render
- No hot-reload in the code editor — must save, then preview

**Draft vs. live:**
- Both the visual editor and code editor work on a **draft** copy of the theme
- Changes do not go live until the merchant clicks "Publish"
- To avoid risk, merchants are encouraged to **Duplicate** a theme before editing

**Versioning:**
- Shopify keeps a timeline of file saves
- Merchants can view previous versions and restore specific files
- Rollback to full previous theme version is possible

### How editing a section's Liquid template works end-to-end

1. Developer opens `sections/hero-banner.liquid` in the code editor
2. Edits the Liquid/HTML
3. Saves → Shopify validates Liquid syntax → Asset API writes the file → render cache is invalidated for that section template
4. Developer previews: opens the storefront URL with theme preview token
5. Server re-renders with new template code
6. When happy, clicks "Publish" → goes live

**ShopForge equivalent (Phase 4):** Our code editor path writes Eta template strings to KV. On save: `KV.put("themes:{themeId}:sections:{type}", newTemplateString)` + `fnCache.delete("{themeId}:{type}")`. Next render compiles fresh. No server restart required.

---

## 10. Publish / Save Flow

### Save vs. Publish

Shopify separates editing from publishing:

| Action | Effect |
|---|---|
| **Save** (in visual or code editor) | Writes changes to the theme's draft state. Customers still see the old version. |
| **Publish** | Replaces the live theme with the draft. Customers now see the new version. Takes effect on next page load. |
| **Duplicate** | Creates a full copy of the current theme (all files + settings). Used as a safety backup before risky edits. |

### Where data is persisted

| Data | Storage location |
|---|---|
| Section settings values | `templates/*.json` (per-page) or `config/settings_data.json` (global) |
| Section order per page | `templates/*.json` — the `order` array |
| Theme global settings | `config/settings_data.json` — the `current` object |
| Liquid template code | `sections/*.liquid`, `snippets/*.liquid`, `layout/*.liquid` — via Asset API |
| CSS / JS assets | `assets/*.css`, `assets/*.js` — via Asset API |
| Compiled Liquid | Shopify's internal render cache — not exposed |

### `settings_data.json` — the global settings store

```json
{
  "current": {
    "color_primary":    "#0f172a",
    "color_secondary":  "#e2e8f0",
    "font_body":        "inter_n4",
    "border_radius":    8
  },
  "presets": {
    "Default": {
      "color_primary": "#000000"
    }
  }
}
```

The visual editor writes the merchant's chosen global settings here. Liquid templates access them via `settings.color_primary` etc.

**ShopForge equivalent:** Our `storeTheme.settings` in KV (`stores:{store_id}:active_theme`). Written by `PUT /api/theme/settings` on our Presentation API. Injected into every section render context as `it.theme`.

---

## 11. Comparison — Shopify vs ShopForge

| Concept | Shopify | ShopForge |
|---|---|---|
| Template language | Liquid (Ruby, Shopify-hosted) | Eta (TypeScript, runs on Bun / CF Workers) |
| Template storage | Git-tracked files on Shopify's servers | Eta strings in Cloudflare KV |
| Template compile | Per-request (cached in Shopify infra) | Compile-once, cached in Worker `Map` — ~0.005ms/render |
| Layout storage | `templates/*.json` files | KV `stores:{id}:active_theme.layout_overrides[]` |
| Global settings | `config/settings_data.json` | KV `stores:{id}:active_theme.settings` |
| Design mode detection | `request.design_mode` + `Shopify.designMode` | `?editor=1` query → Hono sets `it.editorMode` + injects `window.__editorMode = true` |
| Section wrappers | Auto-generated by Shopify renderer | Added by our renderer when `editorMode` |
| Section re-render API | `GET /page?sections=id` → JSON of HTML | `GET /page?sections=id` — same approach |
| Editor → iframe comms | CustomEvents on `iframe.contentDocument` | Same — CustomEvents |
| Color live preview | CSS var injection via `{% style %}` | CSS var injection via inline `<style>` in shell |
| Link interception | Transparent overlay + `elementFromPoint` | Same transparent overlay approach |
| Section schema | `{% schema %}` JSON in Liquid file | JSON schema stored in KV alongside Eta template |
| Blocks within sections | Up to 50 blocks, `shopify:block:select` events | Same concept, Phase 3+ |
| Publish | Two-step: save draft → publish | `PUT /api/layouts/:route` → KV write → live in <1s |
| Code editor | Separate admin UI, Asset API | Phase 4: code editor writes Eta strings to KV |
| Multi-tenancy | One store per Shopify account | Hostname → KV lookup → isolated store config |
| TTFB | 300–800ms | Target: 30–80ms (edge Worker + streaming) |

---

## Key Takeaways for ShopForge

1. **The Section Rendering API is the most important editor endpoint.** Every setting change goes through it. Ours must be fast and correct. Implement `GET /?sections=id` first.

2. **CustomEvents are the right communication model.** Not postMessage (fragile cross-origin). Fire them directly into `iframe.contentDocument`.

3. **Live preview for colors requires CSS custom properties in inline `<style>`.** Don't put theme colors only in static CSS files — the editor can't patch those.

4. **The transparent overlay is cleaner than link-specific JS.** One div over the iframe body intercepts everything — no per-link code.

5. **`shopify:section:load` fires on re-render, not just initial load.** Always write cleanup logic (`shopify:section:unload`) or you get listener stacking bugs. Our Alpine components handle this natively via `$destroy`, but we need to ensure HTMX swap events trigger it.

6. **Sections must have at least one `presets` entry to appear in the "Add section" picker.** Empty presets = section only usable via code. Build presets with sensible defaults for every section type.

7. **Save ≠ Publish is a UX pattern worth copying.** Merchants should be able to see a preview of their changes before going live. Our KV write can be instant — but exposing a preview URL with a token before commit is valuable.

8. **Blocks are Phase 3+ for us, but the schema model must be forward-compatible.** Design our section schema to have a `blocks` array field now, even if we don't render it yet.
