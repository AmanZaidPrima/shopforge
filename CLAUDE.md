## Tooling — always use Bun

- `bun <file>` / `bun run <script>` / `bun install` / `bunx <pkg>`
- `bun test` (not jest/vitest), `bun build` (not webpack/esbuild)
- Bun auto-loads `.env` — no dotenv
- `Bun.file` not `fs`, `Bun.sql` not `pg`, `Bun.redis` not `ioredis`, `bun:sqlite` not `better-sqlite3`
- `Bun.$\`cmd\`` not execa; `WebSocket` built-in, not `ws`
- Use **Hono** for HTTP (runs on Bun + Cloudflare Workers unchanged) — not `Bun.serve()`, not express

---

## Project: High-Performance Storefront Platform

**Monorepo:** `apps/server` (SSR worker) · `apps/api` (builder API) · `apps/editor` (Next.js builder UI)  
**Docs:** `docs/` (root level)

### Stack
- **Runtime:** Bun (dev) → Cloudflare Workers (prod) — same Hono codebase, zero changes
- **Templates:** Eta — compile-once per `{themeId}:{sectionType}`, cached in `Map<string, CompiledFn>`; ~0.005ms/render
- **Frontend:** Alpine.js (7KB) local state + HTMX (14KB) partial updates — no build step, no hydration
- **Storage (Phase 2+):** Cloudflare KV for layout/template strings; Postgres for merchant records

### Architecture

**Multi-tenancy:** `hostname → KV store record → active theme → layout → render`

**Section model** (not "widgets"/"slots"):
- Each section = Eta template string (theme-scoped) + JSON schema + data resolver
- Layout JSON is a flat ordered `sections[]` array, rendered top-to-bottom
- Section templates are theme-scoped: `static/themes/{themeId}/sections/{type}.eta`
- Compile cache key: `{themeId}:{sectionType}` — no collision across themes

**Section render context** (available as `it.*` in every template):
- `it.props` — static merchant config from layout JSON
- `it.data` — dynamic data from backend API resolver
- `it.store` — store name, settings
- `it.theme` — active theme global settings (brand_color, font_family, border_radius)

**HTMX request detection** (no separate fragment routes for page nav):
- Middleware sets `c.set("isHtmx")` from `HX-Request` header
- `renderPage` handler: HTMX request → body sections only; direct request → full HTML shell
- Cart mutations use dedicated action endpoints: `POST /cart/add`, `POST /cart/update`, `DELETE /cart/item/:id`

**Routes:**
```
GET /                      → renderPage (layout key: "home")
GET /products/:handle      → renderPage (layout key: "product")
GET /collections/:handle   → renderPage (layout key: "collection")
GET /cart                  → renderPage (layout key: "cart")
GET /pages/:handle         → renderPage (layout key: "page")
GET *                      → renderPage (catch-all / custom pages)
POST /cart/add             → cartAdd (returns cart fragment)
```

**Layout resolution chain (Phase 2+):**
```
storeTheme.layout_overrides[route] ?? theme.default_layouts[route] ?? 404
```

**KV key structure (Phase 2+):**
```
stores:{hostname}                    → { store_id, api_key, plan }
stores:{store_id}:active_theme       → { theme_id, settings, layout_overrides }
themes:{theme_id}                    → Theme object (schemas, default_layouts)
themes:{theme_id}:sections:{type}    → Eta template string
```

**Data fetching:** `Promise.all` across all sections per page — no waterfall. Total latency = slowest single API call.

**Alpine:** `x-data` per section (isolated), `Alpine.store('cart', ...)` for shared state (survives HTMX body swaps).

### Current Phase: Phase 1 — Prototype
- Deploy target: Fly.io / VPS (not Cloudflare yet)
- Themes: static folders `static/themes/dawn/` + `static/themes/minimal/` — no DB/KV
- Two fixture stores in `fixtures/stores.ts` — proves multi-tenancy
- Section data: fixture JSON (mock backend API)
- No auth, no builder UI, no Redis

**Phase 1 file structure:**
```
apps/server/
  static/themes/{dawn,minimal}/sections/*.eta  ← theme-scoped templates
  static/themes/{dawn,minimal}/theme.css
  static/themes/{dawn,minimal}/schema.json     ← settings_schema + section_schemas + default_layouts
  src/
    index.ts                ← Hono app + middleware
    middleware/htmx.ts      ← sets c.set("isHtmx")
    middleware/tenant.ts    ← resolves store from hostname
    renderer/eta.ts         ← Eta instance, compile cache Map<"{themeId}:{type}", fn>
    renderer/sections.ts    ← renderSections(sections[], ctx) → HTML
    renderer/shell.ts       ← renderShell() / renderSections() based on isHtmx
    renderer/page.ts        ← renderPage(c) handler
    lib/backend-api.ts      ← createApiClient(storeId, apiKey)
    lib/section-data.ts     ← resolveSectionData(type, props, ctx)
    lib/layout-resolver.ts  ← reads from static theme schema files
    fixtures/stores.ts
    fixtures/api-responses/ ← mock backend JSON
```

### Performance targets
- TTFB: 30–80ms (vs Shopify 300–800ms)
- Total JS: ~21KB (Alpine + HTMX only)
- No hydration, SSR-first, stream HTML via `TransformStream`
