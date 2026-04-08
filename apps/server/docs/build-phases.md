# Build Phases — Zero to Production

---

## Phase 0 — Proof of Concept (1–2 days)
**Goal:** Does the core rendering pipeline actually work?  
**Audience:** Just you. No multi-tenancy, no real data, no deployment.

### What you build
- Single Hono server running on Bun locally
- One hardcoded store config object, one hardcoded page layout (plain JS object — flat `sections[]` array)
- 3 sections: `hero-banner`, `product-grid`, `product-card`
- Section templates live in `static/themes/dawn/sections/*.eta` — theme-scoped from day 1
- Eta compiles + renders them — output is real HTML in browser
- Compile cache key is `{themeId}:{sectionType}` from day 1 (e.g. `"dawn:hero-banner"`)
- Section render context: `{ it: { props, data, store, theme } }` — hardcoded `theme` object
- HTMX request detection middleware wired — `HX-Request` header check, one `renderPage` handler
  - HTMX request → return rendered sections only (no shell)
  - Direct request → return full HTML document
- `hx-boost="true"` on body — navigate between a home and a product page, confirm body swap works
- Alpine.js quantity picker on product card
- HTMX Add to Cart → `POST /cart/add` → cart count updates (fixture response)

### What you skip
- No DB, no KV, no Redis
- No multi-tenancy (hardcoded store, hardcoded theme)
- No streaming (just `c.html(html)` — add streaming in Phase 1)
- No builder UI
- No auth
- No real backend API — fixture JSON objects inline in the resolver

### File structure
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
src/
  index.ts           ← Hono app
  renderer.ts        ← Eta instance, compile cache, renderSections()
  section-data.ts    ← hardcoded resolvers with fixture data
  fixtures/
    store.ts         ← hardcoded store + theme config
    layouts.ts       ← hardcoded home.json + product.json as JS objects
```

### Exit criteria
> "I can navigate between two pages without a full reload. I can render a product page from a sections array, click Add to Cart, and see the cart count update — all with no client-side framework doing the rendering."

---

## Phase 1 — Prototype / Demo ← **YOU ARE HERE NEXT**
**Goal:** Show it to someone. Prove the architecture is real.  
**Audience:** Co-founders, early investors, first merchants.  
**Timeline:** 1–2 weeks

### What you build

**Rendering pipeline**
- Hono server on Bun, running locally + deployed to a single VPS or Fly.io (not CF yet)
- Eta section renderer with in-memory compile cache (`Map<"dawn:hero-banner", CompiledFn>`)
- Streaming HTML response (TransformStream) — shell streamed first, sections follow
- HTMX request detection middleware on all routes:
  - HTMX navigation (`HX-Request: true`) → return rendered sections only (no shell)
  - Direct browser request → return full HTML document
- `hx-boost="true"` on `<body>` — all `<a>` clicks become body swaps automatically

**Routing (named routes + catch-all)**
```
GET /                      → renderPage (layout key: home)
GET /products/:handle      → renderPage (layout key: product)
GET /collections/:handle   → renderPage (layout key: collection)
GET /cart                  → renderPage (layout key: cart)
GET /pages/:handle         → renderPage (layout key: page)
POST /cart/add             → cartAdd (returns updated cart fragment)
GET *                      → renderPage (layout key: custom / 404)
```

One `renderPage` handler for all page routes — no separate `/fragments/:section` routes. Cart actions are the only dedicated endpoints.

**Layout JSON (flat files — no DB or KV yet)**
- `static/themes/dawn/schema.json` → `default_layouts: { home: { sections: [...] }, product: {...} }`
- Two stores in `fixtures/stores.ts` with different active theme settings — proves multi-tenancy concept
- Layout is a flat ordered `sections[]` array, rendered top to bottom
- Hand-edit the JSON → restart → page visibly changes

**Layout JSON shape (flat sections, no slots)**
```json
{
  "meta": { "title": "{{ collection.title }} — {{ store.name }}" },
  "sections": [
    { "id": "hdr-1", "type": "site-header", "props": { "menuHandle": "main-nav" } },
    { "id": "main-1", "type": "hero-banner", "props": { "heading": "Summer Sale" } },
    { "id": "main-2", "type": "product-grid", "props": { "columns": 3, "productsPerPage": 12 } },
    { "id": "ftr-1", "type": "site-footer", "props": { "menuHandle": "footer-nav" } }
  ]
}
```

**Themes (two platform themes as static folders)**
- `static/themes/dawn/` — default theme
- `static/themes/minimal/` — second theme
- Both have the same section types but different HTML/CSS
- Compile cache key `{themeId}:{sectionType}` — no collision between themes
- Section template fetched from `static/themes/{themeId}/sections/{type}.eta`
- Merchant (hardcoded) can switch theme by changing `active_theme_id` in fixture

**Section render context**
Every section template receives:
- `it.props` — static merchant config from layout JSON
- `it.data` — dynamic data fetched from backend API (or fixture)
- `it.store` — store name, settings
- `it.theme` — active theme's global settings (brand color, font, border radius)

```html
<!-- themes/dawn/sections/hero-banner.eta -->
<section
  class="hero"
  style="--brand: <%= it.theme.brand_color %>; border-radius: <%= it.theme.border_radius %>px;"
>
  <h1><%= it.props.heading %></h1>
</section>
```

**Sections (6–8 core sections, in both themes)**
- `site-header` — logo, nav links, cart count
- `hero-banner` — heading, subheading, CTA, background image
- `product-grid` — N product cards, columns from props
- `product-card` — image, title, price, Add to Cart
- `collection-filter` — Alpine-powered filter/sort (client state only)
- `site-footer` — links, store name

**Backend API integration**
- `createApiClient(storeId, apiKey)` — the only place that knows the backend's API shape
- All section data fetched via `Promise.all` — no waterfall
- For prototype: mock with JSON fixture files if backend isn't ready
- Each section has a typed resolver — `resolveSectionData(type, props, ctx)`

**Client interactivity**
- Alpine.js: quantity picker, variant selector, cart sidebar open/close
- `Alpine.store("cart", {...})` initialised in shell `<head>` — survives HTMX body swaps
- HTMX: Add to Cart → `POST /cart/add` → server returns updated cart HTML → swaps in

**Performance benchmark**
- Run Lighthouse against your demo URL
- Run same test against a real Shopify store
- Screenshot the diff — this is your demo slide

### What you skip
- No Cloudflare (deploy to Fly.io or Railway)
- No KV, no Redis — static files for layouts, in-memory Map for compiled section fns
- No auth, no builder UI, no merchant onboarding
- No theme clone-on-edit (comes in Phase 2)
- No layout override chain (comes in Phase 2) — theme default layouts only
- No payment integration
- No real product catalog if backend not ready — fixture JSON is fine

### File structure
```
static/
  themes/
    dawn/
      sections/*.eta
      theme.css
      schema.json       ← settings_schema + section_schemas + default_layouts
    minimal/
      sections/*.eta
      theme.css
      schema.json
src/
  index.ts              ← Hono app + middleware
  middleware/
    htmx.ts             ← sets c.set("isHtmx") on every request
    tenant.ts           ← resolves store from hostname (fixture in Phase 1)
  renderer/
    eta.ts              ← Eta instance, compile cache Map<"dawn:hero-banner", fn>
    sections.ts         ← renderSections(sections[], ctx) → HTML string
    shell.ts            ← renderShell(store, html) / renderSections(html)
    page.ts             ← renderPage(c) handler
  lib/
    backend-api.ts      ← createApiClient(storeId, apiKey)
    section-data.ts     ← resolveSectionData(type, props, ctx)
    layout-resolver.ts  ← reads from static theme schema files
  fixtures/
    stores.ts
    api-responses/      ← JSON files mocking backend API
```

### Exit criteria
> "Two demo store URLs, same server, different themes and layouts. HTMX navigation works — no full page reload on link click. Add to Cart updates count without reload. Lighthouse 95+. I can show an investor and they say 'this is fast.'"

---

## Phase 2 — Alpha (3–4 weeks after Phase 1)
**Goal:** A real merchant could use it with help.  
**Audience:** 1–3 design-partner merchants.

### What you add

**Infrastructure**
- Move to Cloudflare Workers (Hono → Workers, zero code change)
- Cloudflare KV replaces fixture files for layout + theme storage
- PostgreSQL (Supabase or Neon) for merchant records — products/orders stay on backend API
- Redis (Upstash) for compiled section fn cache + rendered HTML fragment cache

**KV structure (production shape)**
```
stores:{hostname}                    → { store_id, backend_api_key, plan }
stores:{store_id}:active_theme       → { theme_id, settings, layout_overrides }
themes:{theme_id}                    → Theme object (schemas, default_layouts)
themes:{theme_id}:sections:{type}    → Eta template string
```

**Theme system**
- Theme record in DB + KV: `id`, `slug`, `version`, `is_platform`, `settings_schema`, `default_layouts`
- Global theme settings (`brand_color`, `font_family`, `border_radius`) in `StoreTheme.settings`
- Section templates served from KV: `themes:{theme_id}:sections:{type}`
- Compile cache key: `{themeId}:{sectionType}` — per-theme compiled fn, no collision

**Layout override chain**
```typescript
// Layout resolution order:
storeTheme.layout_overrides[routeKey]   // merchant customisation
  ?? theme.default_layouts[routeKey]    // theme default
  ?? null                               // 404
```
- Fresh store with no customisations → renders beautifully from theme defaults
- Merchant customises a page → override saved, only that page changes

**Clone-on-edit**
- Platform themes (`is_platform: true`) are never mutated for a merchant
- When merchant edits a template/CSS → platform auto-clones theme into their own copy
- Cloned theme: `{ base_theme_id: "dawn", is_platform: false, author: store_id }`
- Original theme untouched — other stores unaffected

**Minimal builder**
- Next.js UI — merchant sees their `sections[]` as a visual list
- Drag to reorder, edit section props via form sidebar
- Switch active theme from theme library
- Change global theme settings (brand color, font, etc.)
- "Publish" → writes `layout_overrides` and `settings` to KV → live in <1s

**Auth**
- Merchant login (NextAuth or Clerk)
- API key per merchant stored in KV — passed as header to backend API

### Exit criteria
> "A merchant can log in, pick a theme, rearrange their homepage, change their brand color, publish, and see it live. Their store loads faster than Shopify."

---

## Phase 3 — Beta (6–8 weeks)
**Goal:** Merchants can self-serve. You can charge money.

### What you add
- Merchant onboarding flow (signup → store setup → domain connection)
- Custom domain provisioning (Cloudflare SSL + DNS automation)
- Checkout + payments (Stripe)
- Order management dashboard
- 20+ sections covering 90% of storefront patterns
- Theme marketplace — additional platform themes
- Webhook system (order created, inventory updated → invalidate relevant cached fragments)
- Analytics dashboard (pageviews, conversion, Core Web Vitals per store)
- Error monitoring (Sentry)
- Billing (Stripe subscriptions, plan limits)
- Platform theme versioning — offer updates to stores on uncloned themes

---

## Phase 4 — Production (ongoing)
**Goal:** Scale, reliability, ecosystem.

### What you add
- Full visual builder (Figma-like drag/drop, inline editing)
- Merchant code editor (edit section `.eta` templates + CSS directly — triggers clone-on-edit)
- App/plugin system (third-party sections)
- Theme export/import — agency white-label themes
- Image optimization pipeline (R2 + Cloudflare Image Resizing)
- A/B testing at the edge (Worker splits traffic, serves layout variants)
- ISR equivalent (cache rendered HTML per page, invalidate on publish)
- Multi-region DB (PlanetScale or Neon branching)
- SLA, uptime monitoring, status page

---

## Phase Summary

| Phase | Timeline | Infra | Theme support | Builder | Goal |
|---|---|---|---|---|---|
| 0 — PoC | 1–2 days | Local only | 1 hardcoded theme | None | Does it render? |
| 1 — Prototype | 1–2 weeks | Fly.io / VPS | 2 static theme folders, switchable | JSON fixtures | Demo to investors |
| 2 — Alpha | 3–4 weeks | Cloudflare + PG | Themes in DB+KV, override chain, clone-on-edit | Basic Next.js UI | Design partners |
| 3 — Beta | 6–8 weeks | Full CF stack | Theme marketplace, versioning | Full visual editor | Paying merchants |
| 4 — Prod | Ongoing | Multi-region | Code editor, export/import, ecosystem | Ecosystem | Scale |

---

## What Phase 1 Must Prove (the real risks)

| Risk | How Phase 1 proves it |
|---|---|
| Eta + Hono streaming is actually fast | Lighthouse 95+ on demo URL |
| Theme-scoped templates work cleanly | Two themes, same section slugs, different HTML — no collision |
| Multi-tenancy works from one codebase | Two demo stores, same server, different themes + layouts |
| HTMX body swap + Alpine re-init works seamlessly | Navigate between pages — no flash, no broken state |
| Cart fragments update without full reload | Add to Cart → count updates → no page reload |
| Flat `sections[]` → rendered page is a clean mapping | Hand-edit layout JSON → restart → page visibly changes |
| Section render context is complete | `it.props`, `it.data`, `it.store`, `it.theme` all available in templates |
