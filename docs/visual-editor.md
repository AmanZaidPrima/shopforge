# Visual Editor — Design Document
## Based on how Shopify actually does it

---

## 1. How Shopify's Editor Actually Works — The Ground Truth

Everything below is sourced from Shopify's official developer docs and their open-source `theme-scripts` repo. No speculation.

### The iframe is the real storefront

Shopify's theme editor loads the actual storefront in an iframe — the same Liquid renderer shoppers see. The editor sidebar is a separate admin UI. The two communicate via a set of well-defined mechanisms.

### Design mode detection

Shopify injects two global variables into the storefront when it is loaded inside the editor iframe:

```javascript
// Available in Liquid templates
request.design_mode  // true | false

// Available in JavaScript inside the storefront
Shopify.designMode   // true | undefined
Shopify.inspectMode  // true | false (preview inspector toggle)
```

Theme developers use these to conditionally change storefront behaviour. For example, an accordion section might expand by default in the editor so merchants can see its content, but collapse by default for shoppers.

### Section identification via data attributes

Shopify wraps every rendered section in a `<div>` with specific data attributes. The editor uses these to know which DOM element corresponds to which section:

```html
<!-- Shopify auto-generates this wrapper around every section -->
<div id="shopify-section-{{ section.id }}" 
     class="shopify-section"
     data-section-id="{{ section.id }}"
     data-section-type="{{ section.type }}">
  <!-- section Liquid content -->
</div>
```

Theme developers must put their section's root element inside this wrapper. The editor reads `data-section-id` to identify which section a merchant clicked.

---

## 2. How the Editor Communicates With the Storefront — The Event System

Shopify does **not** use raw `postMessage` for section interaction. Instead, the editor dispatches **CustomEvents directly into the storefront iframe's document**. The theme listens for these on `document`.

### Events the editor fires into the storefront

| Event | When fired | event.detail |
|---|---|---|
| `shopify:section:load` | Section added or re-rendered | `{ sectionId }` |
| `shopify:section:unload` | Section removed | `{ sectionId }` |
| `shopify:section:select` | Merchant clicks section in sidebar | `{ sectionId, load }` |
| `shopify:section:deselect` | Merchant clicks away | `{ sectionId }` |
| `shopify:section:reorder` | Section dragged to new position | `{ sectionId }` |
| `shopify:block:select` | Merchant clicks a block within a section | `{ sectionId, blockId, load }` |
| `shopify:block:deselect` | Block deselected | `{ sectionId, blockId }` |
| `shopify:inspector:activate` | Preview inspector turned on | — |
| `shopify:inspector:deactivate` | Preview inspector turned off | — |

These events bubble up the DOM and are not cancellable. The `event.target` is the section or block element.

### How theme JS listens for these

```javascript
// Inside the storefront's JavaScript (not editor code)
document.addEventListener('shopify:section:select', (event) => {
  const sectionId = event.detail.sectionId;
  const sectionEl = document.getElementById(`shopify-section-${sectionId}`);
  // Scroll into view, open accordion, play video, etc.
  sectionEl.scrollIntoView({ behavior: 'smooth' });
});

document.addEventListener('shopify:section:load', (event) => {
  // Re-initialise JavaScript for this section
  // (page load events don't re-fire when sections are added)
  const sectionId = event.detail.sectionId;
  initSection(sectionId);
});

document.addEventListener('shopify:block:select', (event) => {
  const { sectionId, blockId } = event.detail;
  // e.g. scroll slideshow to the selected slide
});
```

Shopify's open-source `@shopify/theme-sections` library formalises this pattern — theme developers register a section type and the library wires up the events automatically:

```javascript
import { register } from '@shopify/theme-sections';

register('featured-product', {
  onLoad()        { /* section added or page loaded */ },
  onUnload()      { /* section removed */ },
  onSelect()      { /* merchant clicked section in sidebar */ },
  onDeselect()    { /* merchant clicked away */ },
  onBlockSelect()  { /* merchant clicked a block */ },
  onBlockDeselect(){ /* block deselected */ }
});
```

---

## 3. How Section HTML Updates Without a Full Reload — Section Rendering API

When a merchant changes a setting in the editor sidebar (e.g. changes a heading text, switches an image), Shopify does **not** do a full page reload. Instead it uses the **Section Rendering API**.

### What it is

An AJAX endpoint that returns rendered HTML for one or more sections, in the context of the current page and current settings:

```
GET /?sections=section-id-1,section-id-2
→ returns JSON: { "section-id-1": "<div>...rendered html...</div>", ... }

GET /?section_id=section-id-1
→ returns HTML directly (single section)
```

The request is made against the real storefront URL, so all Liquid context (product, collection, cart, settings) is available exactly as on the real page.

### How the editor uses it

When a merchant changes a setting:

1. Editor saves the new setting value server-side
2. Editor calls the Section Rendering API: `GET /current-page?sections=affected-section-id`
3. Response returns fresh rendered HTML for that section with the new setting applied
4. Editor replaces the section element in the iframe DOM with the new HTML
5. Editor fires `shopify:section:load` so the theme can re-init its JavaScript

```javascript
// Conceptually what the editor does (simplified)
async function rerenderSection(pageUrl, sectionId) {
  const res  = await fetch(`${pageUrl}?sections=${sectionId}`);
  const data = await res.json();
  const el   = iframe.contentDocument.getElementById(`shopify-section-${sectionId}`);
  el.outerHTML = data[sectionId];

  // Fire re-init event into the iframe
  iframe.contentDocument.dispatchEvent(
    new CustomEvent('shopify:section:load', { detail: { sectionId }, bubbles: true })
  );
}
```

### Live preview for certain setting types

Some settings support live preview without any server round-trip. Shopify can apply these client-side immediately:

- **Color settings** — if referenced inside a `{% style %}` tag, the editor injects a CSS custom property update directly
- **Text settings** — if the element matches the setting's DOM target, the editor patches the text node directly
- **Range/number settings** — same CSS variable injection approach

Only if the setting doesn't qualify for live preview does the editor fall back to a full Section Rendering API call.

---

## 4. Section Schema — How Sections Define Their Editor UI

Every section's Liquid file contains a `{% schema %}` tag with JSON that tells the editor exactly what settings to show in the sidebar. This is Shopify's equivalent of our section schema in KV.

```liquid
{% schema %}
{
  "name": "Hero banner",
  "tag": "section",
  "class": "hero-section",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "Heading",
      "default": "Welcome"
    },
    {
      "type": "image_picker",
      "id": "background_image",
      "label": "Background image"
    },
    {
      "type": "color",
      "id": "text_color",
      "label": "Text color",
      "default": "#ffffff"
    },
    {
      "type": "range",
      "id": "overlay_opacity",
      "label": "Overlay opacity",
      "min": 0, "max": 100, "step": 5, "default": 40
    }
  ],
  "blocks": [
    {
      "type": "button",
      "name": "Button",
      "settings": [
        { "type": "text",    "id": "label", "label": "Label" },
        { "type": "url",     "id": "link",  "label": "Link" }
      ]
    }
  ],
  "presets": [
    {
      "name": "Hero banner",
      "blocks": [
        { "type": "button" }
      ]
    }
  ]
}
{% endschema %}
```

Key schema concepts:

- **`settings`** — flat list of inputs. Rendered as the props form in the editor sidebar
- **`blocks`** — repeatable units within a section. Merchants add, remove, reorder them. Max 50 per section
- **`presets`** — predefined starting configurations. A section must have at least one preset to appear in the "Add section" picker
- **`enabled_on`** — restricts which page template types the section can be added to
- **`tag`** — the HTML element the section wrapper uses (default `div`)

Settings accessed in Liquid via `section.settings.id` and `block.settings.id`.

---

## 5. JSON Templates — How Page Layouts Are Stored

Shopify's equivalent of our layout JSON is the **JSON template**. Each page type has a JSON file in `templates/`:

```json
// templates/index.json  (the home page)
{
  "sections": {
    "hero": {
      "type": "hero-banner",
      "settings": {
        "heading": "Summer Sale",
        "overlay_opacity": 40
      },
      "blocks": {
        "button-1": {
          "type": "button",
          "settings": { "label": "Shop Now", "link": "/collections/all" }
        }
      },
      "block_order": ["button-1"]
    },
    "product-grid": {
      "type": "product-grid",
      "settings": { "columns": 3, "products_per_page": 8 }
    }
  },
  "order": ["hero", "product-grid"]
}
```

This is structurally identical to our `sections[]` array — an ordered set of section instances with their props. Shopify uses a named object + `order` array; we use a flat ordered array. The concept is the same.

---

## 6. How Adding a Section Works

When a merchant clicks "Add section" in the editor:

1. Editor shows section picker — lists all sections that have `presets` defined in their schema
2. Merchant picks a section type (e.g. "Image with text")
3. Editor writes the new section entry into the JSON template with preset defaults
4. Editor calls Section Rendering API to get the rendered HTML for the new section
5. Editor injects the HTML at the correct position in the iframe DOM
6. Editor fires `shopify:section:load` so the theme's JS initialises
7. Editor fires `shopify:section:select` so the new section scrolls into view and the sidebar opens its settings

No page reload at any point.

---

## 7. How Link Disabling Works

Shopify does not inject a separate "bridge script" to disable links. The mechanism is simpler: **the editor detects clicks at the iframe level via pointer events and the `Shopify.designMode` flag**.

Specifically:

- In design mode, the editor overlays an invisible transparent div on top of the iframe's `<body>` — this intercepts all clicks before they reach the storefront DOM
- Clicking on a section through this overlay tells the editor which `data-section-id` was hit (via pointer position + `elementFromPoint`)
- The editor then fires `shopify:section:select` into the iframe document
- The transparent overlay prevents all `<a>` tags from navigating — no special link interception code needed

The `Shopify.designMode` flag is available so theme developers can also conditionally disable their own JS behaviours (e.g. auto-playing carousels, video autoplay) in the editor.

---

## 8. What This Means for Our Architecture

Mapping Shopify's actual approach to our stack:

| Shopify concept | Our equivalent |
|---|---|
| `request.design_mode` Liquid variable | `?editor=1` query param detected in Hono, sets `it.editorMode` in Eta context |
| `Shopify.designMode` JS global | Injected `<script>window.__editorMode = true</script>` in shell when editorMode |
| `data-section-id` / `data-section-type` on wrapper div | Same — add wrapper div only when `editorMode` |
| CustomEvents (`shopify:section:select` etc.) | Same pattern — editor dispatches CustomEvents into iframe document |
| Section Rendering API (`?sections=id`) | Our equivalent: `GET /?sections=section-id` — Hono detects `sections` param, returns JSON of rendered section HTML |
| JSON template (`templates/index.json`) | Our layout JSON in KV (`sections[]` ordered array) |
| Section `{% schema %}` tag | Our section schema stored in KV alongside the Eta template |
| Live preview for color/text | CSS custom property injection for color settings; text node patching for text settings |
| Preset picker ("Add section") | Same — sections with `presets` in schema appear in our Add Section drawer |
| Transparent overlay for click interception | Same approach — editor-side overlay div, `elementFromPoint` to identify section |

### Section Rendering API — our implementation

```
GET /collections/shoes?sections=product-grid-abc123
→ Hono detects `sections` query param
→ Renders only those section IDs with current layout settings
→ Returns JSON: { "product-grid-abc123": "<div data-section-id='...'>...</div>" }
```

This is the single most important endpoint for editor performance. Every setting change hits this instead of reloading the page.

---

## 9. Phase Rollout (revised)

| Phase | What to build |
|---|---|
| 0 — PoC | No editor. Hand-edit layout JSON, refresh to see. |
| 1 — Prototype | iframe loads storefront with `?editor=1`. `Shopify.designMode` equivalent injected. Transparent overlay intercepts clicks. `data-section-id` on wrappers. Click → sidebar opens section schema form. Publish writes layout to KV. |
| 2 — Alpha | Section Rendering API endpoint. Setting change → AJAX re-render of section, no full reload. `shopify:section:load` equivalent CustomEvents. Add section from preset picker. Drag to reorder. |
| 3 — Beta | Block-level editing (blocks within sections). Live preview for color/text settings (CSS var injection). Undo/redo stack. Device preview (iframe width toggle). |
| 4 — Prod | Full inline editing. Code editor for Eta templates. Section schema editor. Theme settings panel. |
