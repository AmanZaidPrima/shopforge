# Build Phases — Zero to Production

---

## Monorepo Structure

```
apps/
  server/   ← SSR rendering worker (Hono + Eta) — presentation only, no data ownership
  presentation-api/  ← Presentation API (Hono) — layout/theme writes to KV, merchant auth
  store-api/         ← Store API (Hono) — products, collections, orders, cart (Phase 3+)
  editor/   ← Builder UI (Next.js) — visual drag-and-drop editor
docs/       ← Architecture docs (root level)
```

**Boundary rule:** `apps/server` never owns data. It calls `apps/presentation-api` (or the backend API) for everything. All ecommerce data (products, orders, cart, customers) lives in the backend team's API.

---

## Phase 0 — Proof of Concept ✅ DONE

**Goal:** Does the core rendering pipeline work?

### What was built
- Single Hono server on Bun, one hardcoded store, hardcoded layouts
- 3 sections (hero-banner, product-grid, product-card) in dawn theme
- Eta compile-once cache, HTMX detection middleware, hx-boost navigation
- Alpine quantity picker, fixture Add to Cart

### File structure (as built, inside `apps/server/`)
```
src/
  index.ts            ← Hono app
  renderer.ts         ← Eta instance + renderSections() (monolithic)
  section-data.ts     ← inline fixture resolvers
  fixtures/
    store.ts          ← hardcoded store + theme
    layouts.ts        ← hardcoded home + product layouts
static/themes/dawn/
  sections/{3 sections}.eta
  theme.css
```

---

## Phase 1 — Prototype ✅ DONE

**Goal:** Show it to someone. Prove the architecture is real.

### What was built

**Monorepo:** `apps/server/` fully implemented. `apps/presentation-api/` and `apps/editor/` scaffolded (empty).

**Rendering pipeline**
- Hono + Eta on Bun, streaming HTML via `TransformStream`
- HTMX detection middleware → body-only vs full shell
- `hx-boost="true"` on `<body>` — all nav is body swaps, no full reload
- Section compile cache key: `{themeId}:{sectionType}` — no cross-theme collision

**Routing**
```
GET /                      → renderPage (layout key: "home")
GET /products/:handle      → renderPage (layout key: "product")
GET /collections/:handle   → renderPage (layout key: "collection")
GET /cart                  → renderPage (layout key: "cart")
GET /pages/:handle         → renderPage (layout key: "page")
POST /cart/add             → fixture response (count: 1)
GET *                      → renderPage (catch-all)
```

**Themes** — two static theme folders, same 8 section slugs, different HTML/CSS:
- `static/themes/dawn/` — brand: #0f172a, inter font
- `static/themes/minimal/` — brand: #6366f1, dm-sans font
- Each has: `sections/*.eta` + `theme.css` + `schema.json`
- `schema.json` contains `settings_schema` + `default_layouts` for all 5 route keys

**Sections (8, in both themes)**
- `site-header` — logo, nav, cart count
- `hero-banner` — heading, CTA, brand-colored background
- `product-grid` — grid loop, fixture products, HTMX Add to Cart
- `product-card` — 2-column detail page, variant + quantity picker
- `collection-filter` — Alpine-powered search + sort (client state only)
- `cart-page` — Alpine.store-driven cart display
- `content-page` — generic about/contact
- `site-footer` — links, copyright

**Multi-tenancy**
- `localhost` → Dawn Demo Store (theme: dawn)
- `minimal.localhost` → Minimal Demo Store (theme: minimal)
- Tenant resolved from hostname in `tenantMiddleware`

**Section render context**
- `it.props` — static merchant config from layout JSON
- `it.data` — dynamic data from fixture resolver
- `it.store` — store id, name, hostname
- `it.theme` — brand_color, font_family, border_radius

### Actual file structure (as built)
```
apps/server/
  index.ts                      ← re-exports src/index.ts
  package.json                  ← hono, eta, @types/bun
  tsconfig.json
  static/themes/
    dawn/
      sections/                 ← 8 .eta templates
      theme.css
      schema.json               ← settings_schema + default_layouts
    minimal/
      sections/                 ← 8 .eta templates (different HTML, same slugs)
      theme.css
      schema.json
  src/
    index.ts                    ← Hono app + route definitions
    types.ts                    ← Section, PageLayout, Store, ThemeSettings, AppEnv
    middleware/
      htmx.ts                   ← c.set("isHtmx") from HX-Request header
      tenant.ts                 ← resolves store from hostname
    renderer/
      eta.ts                    ← Eta instance, Map<"{themeId}:{type}", CompiledFn>
      page.ts                   ← renderPage() — stream shell+sections or sections-only
      sections.ts               ← renderSections() — Promise.all data fetch + Eta render
      shell.ts                  ← shellTop(store) / shellBottom()
    lib/
      backend-api.ts            ← createApiClient() stub (fixture-backed in Phase 1)
      section-data.ts           ← resolveSectionData(type, props, ctx) per section type
      layout-resolver.ts        ← reads schema.json, resolves layout by route key
    fixtures/
      stores.ts                 ← two demo stores (hostname → store config)
      products.ts               ← 6 fixture products with variants
```

> Note: `src/renderer.ts` and `src/section-data.ts` at root of src are legacy from Phase 0 — superseded by `renderer/` and `lib/` folders.

### What was skipped (intentionally)
- No Cloudflare deployment
- No KV, Redis, or DB
- No builder UI or API
- No auth or merchant onboarding
- No real backend API — `backend-api.ts` returns fixture data
- No theme clone-on-edit or layout override chain

---

## Phase 2 — Alpha ← **NEXT**

**Goal:** A real merchant could use it with help.  
**Audience:** 1–3 design-partner merchants.

### What to build

**`apps/server` changes**
- Move to Cloudflare Workers (zero Hono code change)
- Replace fixture stores with KV lookup: `stores:{hostname}`
- Replace static schema.json with KV lookup: `themes:{theme_id}:sections:{type}`
- Wire `createApiClient()` to real backend API (replace fixture resolvers)
- Layout override chain: `storeTheme.layout_overrides[route] ?? theme.default_layouts[route] ?? 404`
- Streaming remains unchanged

**`apps/presentation-api` — Builder API (new)**
- Hono app, separate from SSR server
- Auth: merchant login (Clerk or NextAuth)
- Endpoints:
  - `PUT /layouts/:route` → KV.put layout override for merchant
  - `PUT /theme/settings` → KV.put theme settings for merchant
  - `GET /themes` → list available platform themes
  - `POST /themes/activate` → switch active theme (clears layout_overrides)
- No product/order endpoints — those belong to the backend team's API

**`apps/editor` — Builder UI (new)**
- Next.js app
- Merchant sees their `sections[]` as a visual reorderable list
- Edit section props via sidebar form
- Switch active theme from theme library
- Change global theme settings (brand color, font, border radius)
- "Publish" → calls `apps/presentation-api` → KV write → live in <1s

**Infrastructure**
- Cloudflare KV for layout + theme storage
- PostgreSQL (Supabase or Neon) for merchant records
- Redis (Upstash) for rendered HTML fragment cache

**KV key structure**
```
stores:{hostname}                    → { store_id, backend_api_key, plan }
stores:{store_id}:active_theme       → { theme_id, settings, layout_overrides }
themes:{theme_id}                    → Theme object (schemas, default_layouts)
themes:{theme_id}:sections:{type}    → Eta template string
```

**Theme system**
- Platform themes (`is_platform: true`) never mutated for a merchant
- Clone-on-edit: first template/CSS edit → platform clones theme to `{ base_theme_id, is_platform: false, author: store_id }`
- Compile cache invalidation: `fnCache.delete("{themeId}:{type}")` on KV write

### Monorepo structure at end of Phase 2
```
apps/
  server/    ← SSR Worker (Hono + Eta, CF Workers target)
  api/       ← Builder API (Hono, handles layout/theme writes)
  editor/    ← Builder UI (Next.js)
```

### Exit criteria
> "A merchant can log in, pick a theme, rearrange their homepage, change their brand color, publish, and see it live. Their store loads faster than Shopify."

---

## Phase 3 — Beta (6–8 weeks)

**Goal:** Merchants can self-serve. You can charge money.

### What to add
- Merchant onboarding (signup → store setup → domain connection)
- Custom domain provisioning (Cloudflare SSL + DNS automation)
- Checkout + payments (Stripe) — via backend team's API
- 20+ sections covering 90% of storefront patterns
- Theme marketplace — additional platform themes
- Webhook system (inventory updated → invalidate cached fragments)
- Analytics dashboard (Core Web Vitals per store)
- Billing (Stripe subscriptions, plan limits)
- Error monitoring (Sentry)
- Platform theme versioning — offer updates to uncloned theme stores

---

## Phase 4 — Production (ongoing)

**Goal:** Scale, reliability, ecosystem.

### What to add
- Full visual builder (Figma-like drag/drop, inline editing)
- Merchant code editor (edit `.eta` templates + CSS → triggers clone-on-edit)
- App/plugin system (third-party sections)
- Theme export/import — agency white-label
- Image optimization (R2 + Cloudflare Image Resizing)
- A/B testing at edge (Worker splits traffic, serves layout variants)
- ISR equivalent (cache rendered HTML per page, invalidate on publish)
- Multi-region DB
- SLA, uptime monitoring, status page

---

## Phase Summary

| Phase | Status | Infra | Theme support | Builder | Goal |
|---|---|---|---|---|---|
| 0 — PoC | ✅ Done | Local only | 1 theme, hardcoded | None | Does it render? |
| 1 — Prototype | ✅ Done | Local (Bun) | 2 static themes, fixture multi-tenancy | None | Demo to investors |
| 2 — Alpha | Next | Cloudflare + PG | KV themes, override chain, clone-on-edit | Basic Next.js UI | Design partners |
| 3 — Beta | — | Full CF stack | Theme marketplace, versioning | Full visual editor | Paying merchants |
| 4 — Prod | — | Multi-region | Code editor, export/import, ecosystem | Ecosystem | Scale |
