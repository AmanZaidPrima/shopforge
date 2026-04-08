# Theme Architecture
## Design Document — Multi-Tenant Storefront Engine

---

## 1. What a Theme Is

A theme is a **versioned, self-contained rendering package**. It owns everything that determines how a storefront looks and behaves:

| Concern | Owned by theme | Example |
|---|---|---|
| Section templates | Yes | `hero-banner.eta`, `product-grid.eta` |
| Stylesheet | Yes | `theme.css` — defines all class names sections use |
| Default page layouts | Yes | Default `sections[]` for home, product, collection pages |
| Section schemas | Yes | What props each section accepts, types, defaults |
| Global settings schema | Yes | Font family, brand colors, border radius options |
| Global settings values | No — owned by store | Merchant's chosen font, brand color |
| Page layout overrides | No — owned by store | Merchant's customised `sections[]` per page |

The last two rows are critical: **a theme defines the shape of customisation, a store fills it in.** This is exactly how Shopify separates theme authors from merchant configuration.

A section template from Theme A cannot be safely dropped into Theme B — it references CSS classes, partials, and Alpine component patterns that only exist within that theme. Themes must stay cohesive as a unit.

---

## 2. Theme Data Model

```typescript
type Theme = {
  id: string;                    // uuid
  slug: string;                  // "dawn", "minimal", "bold"
  name: string;                  // "Dawn"
  version: string;               // "1.0.0" — semver
  author: string;                // "platform" | merchant store_id
  base_theme_id: string | null;  // if cloned, points to parent theme
  is_platform: boolean;          // true = shipped by you, false = merchant-customised clone
  stylesheet_url: string;        // R2/CDN URL for theme.css
  settings_schema: SettingsSchema; // what global settings this theme supports
  section_schemas: Record<string, SectionSchema>; // props schema per section type
  default_layouts: Record<string, PageLayout>;    // default sections[] per route key
  created_at: string;
};

type StoreTheme = {
  store_id: string;
  theme_id: string;              // which theme is active
  settings: Record<string, unknown>; // merchant's values for settings_schema
  layout_overrides: Record<string, PageLayout>; // merchant's customised pages
  // layout resolution: override ?? theme.default_layouts[route]
};
```

### KV key structure

```
themes:{theme_id}                    → Theme object (template strings, schemas, defaults)
themes:{theme_id}:sections:{type}    → Eta template string for this section
stores:{store_id}:active_theme       → { theme_id, settings, layout_overrides }
```

---

## 3. Section Templates Belong to a Theme

A section template is not a global entity — it is scoped to a theme. Two themes can both have a `hero-banner` section, but they are different templates with different HTML structure and different CSS class assumptions.

```
static/
  themes/
    dawn/
      sections/
        site-header.eta
        hero-banner.eta
        product-grid.eta
        product-card.eta
        site-footer.eta
      theme.css
      schema.json          ← settings_schema + section_schemas + default_layouts
    minimal/
      sections/
        site-header.eta
        hero-banner.eta
        ...
      theme.css
      schema.json
```

### Fetching a section template — theme-scoped

```typescript
// lib/section-store.ts

const BASE = process.env.STATIC_BASE_URL ?? "http://localhost:3000";
const templateCache = new Map<string, string>();

export async function getSectionTemplate(
  themeId: string,
  type: string
): Promise<string | null> {
  const key = `${themeId}:${type}`;
  if (templateCache.has(key)) return templateCache.get(key)!;

  const res = await fetch(`${BASE}/static/themes/${themeId}/sections/${type}.eta`);
  if (!res.ok) return null;

  const template = await res.text();
  templateCache.set(key, template);
  return template;
}
```

The compile cache key is now `{themeId}:{sectionType}` — two themes with a `hero-banner` section compile to separate cached functions. No collision.

---

## 4. Layout Resolution — Override Chain

When rendering a page, the layout is resolved in order:

```
1. Does store have a layout override for this route?
   → stores:{store_id}:active_theme.layout_overrides[routeKey]
   → YES: use merchant's customised sections[]

2. Does the active theme have a default layout for this route?
   → themes:{theme_id}.default_layouts[routeKey]
   → YES: use theme's default sections[]

3. No layout found → 404
```

```typescript
// lib/layout-resolver.ts

export async function resolveLayout(
  storeTheme: StoreTheme,
  theme: Theme,
  routeKey: string
): Promise<PageLayout | null> {
  return (
    storeTheme.layout_overrides[routeKey] ??
    theme.default_layouts[routeKey] ??
    null
  );
}
```

This means a merchant who has never touched the builder gets a beautiful default page from the theme. The moment they customise a page in the builder, their override is saved — and only that page changes.

---

## 5. Global Theme Settings

A theme defines what global settings it supports. The merchant fills them in via the builder. These settings are injected into every section render context.

```json
// themes/dawn/schema.json (partial)
{
  "settings_schema": {
    "brand_color":    { "type": "color",  "default": "#000000", "label": "Brand color" },
    "font_family":    { "type": "select", "default": "inter",   "label": "Font",
                        "options": ["inter", "playfair", "dm-sans"] },
    "border_radius":  { "type": "range",  "default": 8,         "label": "Corner radius", "min": 0, "max": 24 }
  }
}
```

```typescript
// Available in every section template as it.theme
// themes/dawn/sections/hero-banner.eta
<section
  class="hero"
  style="--brand: <%= it.theme.brand_color %>; border-radius: <%= it.theme.border_radius %>px;"
>
  ...
</section>
```

CSS custom properties carry theme settings into the stylesheet — the `.eta` template injects them as inline CSS vars on section root elements. The stylesheet references `var(--brand)` throughout.

---

## 6. Theme Lifecycle — How a Merchant Changes or Customises a Theme

### Scenario A — Switch to a different platform theme

Merchant picks "Minimal" from the theme library.

```
1. Store's active_theme_id → points to "minimal" theme
2. layout_overrides → CLEARED (they chose a new theme, start fresh)
3. settings → reset to theme defaults
4. Next request: Worker reads new theme_id from KV → renders with Minimal's templates + CSS
```

This is a clean atomic switch. The old theme and any customisations are gone — merchant chose to switch.

### Scenario B — Customise the active theme

Merchant wants to tweak the hero banner layout on their home page.

```
1. Builder loads: theme.default_layouts["home"] as the starting point
2. Merchant reorders sections, changes props
3. Builder saves: layout_overrides["home"] = merchant's sections[]
4. KV updated → live in <1s
5. Next request: override exists → merchant's layout rendered, not theme default
```

The theme's templates are still used — only the layout JSON (which sections appear, in what order, with what props) is overridden. The merchant is configuring the theme, not modifying it.

### Scenario C — Customise the theme itself (edit templates/CSS)

Merchant wants to change the HTML structure of the hero banner section.

```
1. Builder triggers "Customise theme" action
2. Platform CLONES the active theme:
   a. New theme record created: { base_theme_id: "dawn", is_platform: false, author: store_id }
   b. All section templates copied under new theme_id in KV/R2
   c. theme.css copied
   d. schema.json copied
   e. Store's active_theme_id → new cloned theme_id
   f. layout_overrides → carried over from previous active theme
3. Merchant edits hero-banner.eta in the code editor
4. Saved back to KV under new theme_id
5. Original "dawn" theme untouched — other stores using it unaffected
```

This is identical to Shopify's "Duplicate theme before editing" — except we do it automatically on first edit rather than asking the merchant to do it manually.

### Scenario D — Platform releases a theme update

Platform updates "Dawn" to v1.1.0 with an improved product grid.

```
Stores using platform Dawn (is_platform: true):
  → Can be offered the update
  → Accepting it: active_theme_id points to new Dawn v1.1.0
  → Their layout_overrides are preserved (they only override page structure, not templates)

Stores using a cloned Dawn (is_platform: false):
  → NOT automatically updated — they forked the theme, they own it now
  → Builder can offer: "A new version of the theme you're based on is available.
     Would you like to see what changed?" (manual merge decision)
```

---

## 7. What the Builder Saves — Theme vs Store Data

| Action in builder | What changes | Where saved |
|---|---|---|
| Reorder sections on a page | `layout_overrides[route]` | KV: `stores:{id}:active_theme` |
| Change a section's props | `layout_overrides[route]` | KV: `stores:{id}:active_theme` |
| Change brand color / font | `settings` | KV: `stores:{id}:active_theme` |
| Add/remove a section | `layout_overrides[route]` | KV: `stores:{id}:active_theme` |
| Edit a section's HTML/CSS | Clone → edit cloned template | KV: `themes:{cloned_id}:sections:{type}` |
| Publish layout change | KV write → live in <1s | KV (instant global propagation) |

The theme's own files (`dawn/sections/hero-banner.eta`, `dawn/theme.css`) are **never mutated** for a merchant customisation — they are either used as-is or cloned first.

---

## 8. Phase Rollout for Themes

| Phase | Theme support |
|---|---|
| 0 — PoC | One hardcoded theme folder, no theme concept in code |
| 1 — Prototype | Theme ID in section store path. Two platform themes (e.g. `dawn`, `minimal`) as static folders. Merchant can switch. No cloning. |
| 2 — Alpha | Theme record in DB. Settings schema + global settings. Layout override chain. Clone-on-edit. |
| 3 — Beta | Theme marketplace. Version tracking. Platform update notifications for uncloned themes. |
| 4 — Prod | Merchant code editor in builder. Theme export/import. Agency white-label themes. |
