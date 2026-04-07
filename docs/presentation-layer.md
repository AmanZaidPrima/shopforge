# Presentation Layer Architecture
## Multi-Tenant Storefront Engine

---

## 1. Revised Scope

Your backend team owns:
- Products, collections, inventory
- Orders, cart, checkout
- Merchants / store settings
- Auth, customers
- All ecom REST APIs

You own:
- How pages look and are structured (layout JSON)
- How templates render the API data to HTML (Eta template strings)
- How fast the HTML reaches the browser (edge rendering, streaming)
- How merchants configure their storefront visually (builder)
- Multi-tenancy at the presentation layer

```
┌────────────────────────────────────────────────────┐
│              YOUR BOUNDARY                         │
│                                                    │
│   Layout JSON  →  Storefront Worker  →  HTML       │
│       (KV)           (Hono/Eta)       (browser)    │
│                         │                          │
└─────────────────────────┼──────────────────────────┘
                          │ REST API calls
                          ▼
┌────────────────────────────────────────────────────┐
│           BACKEND TEAM'S BOUNDARY                  │
│                                                    │
│   Products API  │  Orders API  │  Merchants API    │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 2. What You Need to Store

Your persistence layer is minimal — only presentation data.

### Cloudflare KV (edge-accessible, low-latency reads)

```
stores:{hostname}
  → { store_id, backend_api_key, plan, settings }
  
layouts:{store_id}:{route_pattern}
  → page layout JSON (slot → widget config)
  
widgets:{store_id}:{slug}
  → { template_string, schema, version }
  
widgets:global:{slug}
  → platform-default widget templates (shared across all stores)
```

### What you do NOT need to store
- Products, prices, inventory → live API call per request (cached)
- Orders, customers → backend owns it
- Cart state → backend owns it, you just render what it returns

---

## 3. Data Flow Per Request

```
Browser: GET mystore.com/collections/shoes
         │
         ▼
Cloudflare CDN ──(HTML cache hit, <8ms)──► return cached HTML
         │ miss
         ▼
Cloudflare Worker (Hono)
         │
         ├─ 1. Resolve tenant
         │      KV.get("stores:mystore.com")
         │      → { store_id, api_key, settings }
         │
         ├─ 2. Match route → resolve layout
         │      KV.get("layouts:{store_id}:/collections/:handle")
         │      → { slots: { header: [...], main: [...], footer: [...] } }
         │
         ├─ 3. Identify data needs from layout
         │      product-grid widget → needs GET /collections/shoes/products
         │      site-header widget → needs GET /cart (count only)
         │
         ├─ 4. Fetch all data in parallel
         │      Promise.all([
         │        backendApi.getCollection("shoes", { store_id, api_key }),
         │        backendApi.getCartCount(cookieToken),
         │      ])
         │
         ├─ 5. Render each widget via Eta (compile-once cache)
         │      slot by slot, streaming HTML chunks to browser
         │
         └─ 6. Stream complete HTML
```

---

## 4. Backend API Integration Layer

Wrap every backend API call in a typed client. This is the only place in your codebase that knows about the backend's API shape.

```typescript
// lib/backend-api.ts

const BASE = process.env.BACKEND_API_URL; // e.g. https://api.yourplatform.com

export function createApiClient(storeId: string, apiKey: string) {
  const headers = {
    "X-Store-Id": storeId,
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const get = (path: string, cacheTtl = 30) =>
    fetch(`${BASE}${path}`, { headers, cf: { cacheTtl } }).then(r => r.json());

  return {
    // Products
    getProduct: (handle: string) =>
      get(`/products/${handle}`),
    getProducts: (params: ProductQueryParams) =>
      get(`/products?${new URLSearchParams(params)}`),

    // Collections
    getCollection: (handle: string) =>
      get(`/collections/${handle}`),
    getCollectionProducts: (handle: string, params = {}) =>
      get(`/collections/${handle}/products?${new URLSearchParams(params)}`),

    // Cart (no cache — always fresh)
    getCart: (cartToken: string) =>
      fetch(`${BASE}/cart`, {
        headers: { ...headers, "X-Cart-Token": cartToken },
        cf: { cacheTtl: 0 }
      }).then(r => r.json()),

    // Store settings (rarely changes — cache longer)
    getStoreSettings: () =>
      get(`/store/settings`, 300),

    // Navigation / menus
    getMenu: (handle: string) =>
      get(`/menus/${handle}`, 600),
  };
}
```

### Caching strategy for API calls

| Data type | Cache TTL | Reason |
|---|---|---|
| Product detail | 60s | Changes infrequently |
| Collection products | 30s | Inventory updates matter |
| Cart | 0s | Always must be fresh |
| Store settings | 300s | Rarely changes |
| Navigation menus | 600s | Almost never changes |
| Inventory badge | 10s | Flash sales, stock counts |

Caching happens at the CF Worker fetch level — `cf: { cacheTtl: N }` on the `fetch()` call caches the backend response at the nearest CF edge node. The backend never gets hit for the same data twice within the TTL window.

---

## 5. Layout JSON Schema

This is the core presentation data structure your system owns.

```typescript
// types/layout.ts

type Section = {
  id: string;              // unique instance ID (for builder targeting)
  type: string;            // slug — matches section template in KV e.g. "product-grid"
  disabled?: boolean;      // merchant can hide without deleting
  props: Record<string, unknown>; // static config set by merchant in builder
  // NOTE: dynamic data (products, cart) is fetched at render time
  //       props are only merchant-controlled presentation config
};

type PageLayout = {
  meta: {
    title: string;          // page <title> template, e.g. "{{ collection.title }} — {{ store.name }}"
    description?: string;
  };
  sections: Section[];      // ordered array — rendered top to bottom, no slots
};
```

### Example: Collection page layout JSON

```json
{
  "meta": {
    "title": "{{ collection.title }} — {{ store.name }}"
  },
  "sections": [
    {
      "id": "hdr-1",
      "type": "site-header",
      "props": { "logoUrl": "/logo.svg", "menuHandle": "main-nav" }
    },
    {
      "id": "main-1",
      "type": "collection-hero",
      "props": { "showDescription": true }
    },
    {
      "id": "main-2",
      "type": "product-grid",
      "props": {
        "columns": 3,
        "showFilters": true,
        "productsPerPage": 24,
        "sortOptions": ["price-asc", "price-desc", "newest"]
      }
    },
    {
      "id": "ftr-1",
      "type": "site-footer",
      "props": { "menuHandle": "footer-nav" }
    }
  ]
}
```

---

## 6. Section Template Model

Each section is an Eta template string stored in KV. At render time, it receives:
- `it.props` — the static merchant config from layout JSON
- `it.data` — the dynamic data fetched from the backend API
- `it.store` — current store context (name, settings, currency)
- `it.request` — current request context (path, params, cart token)

```html
<!-- KV: sections:{store_id}:product-grid -->

<section class="product-grid" x-data="productGrid()">

  <% if (it.props.showFilters) { %>
    <%~ include('partials/collection-filters', { filters: it.data.filters }) %>
  <% } %>

  <div
    class="grid grid-cols-<%= it.props.columns %>"
    id="product-grid-results"
  >
    <% for (const product of it.data.products) { %>
      <%~ include('sections/product-card', { product, store: it.store }) %>
    <% } %>
  </div>

  <% if (it.data.pagination.hasNext) { %>
    <button
      hx-get="/fragments/product-grid?page=<%= it.data.pagination.nextPage %>&collection=<%= it.data.collection.handle %>"
      hx-target="#product-grid-results"
      hx-swap="afterend"
    >
      Load more
    </button>
  <% } %>

</section>
```

### Section data resolver — maps section type to API calls

```typescript
// lib/section-data.ts

type ResolverContext = {
  api: ReturnType<typeof createApiClient>;
  request: Request;
  store: StoreConfig;
  routeParams: Record<string, string>; // e.g. { handle: "shoes" }
};

const resolvers: Record<string, (props: any, ctx: ResolverContext) => Promise<unknown>> = {

  "site-header": async (props, { api, request }) => ({
    menu: await api.getMenu(props.menuHandle),
    cartCount: await api.getCart(getCartToken(request)).then(c => c.item_count),
  }),

  "product-grid": async (props, { api, routeParams }) => ({
    collection: await api.getCollection(routeParams.handle),
    products: await api.getCollectionProducts(routeParams.handle, {
      limit: props.productsPerPage,
      sort: props.defaultSort,
    }),
    filters: await api.getCollectionFilters?.(routeParams.handle) ?? [],
  }),

  "product-detail": async (props, { api, routeParams }) => ({
    product: await api.getProduct(routeParams.handle),
  }),

  "hero-banner": async (props) => ({
    // purely static — no API call needed, props are enough
  }),

  "site-footer": async (props, { api }) => ({
    menu: await api.getMenu(props.menuHandle),
    store: await api.getStoreSettings(),
  }),
};

export async function resolveSectionData(type: string, props: any, ctx: ResolverContext) {
  const resolver = resolvers[type];
  if (!resolver) return {};
  return resolver(props, ctx);
}
```

---

## 7. Parallel Data Fetching Per Page

The key to low TTFB — fetch all widget data for a page in one `Promise.all`, not sequentially.

```typescript
// renderer/page.ts

export async function renderPage({ store, layout, request, routeParams }) {

  const api = createApiClient(store.store_id, store.api_key);
  const ctx = { api, request, store, routeParams };

  // Filter out disabled sections
  const sections = layout.sections.filter(s => !s.disabled);

  // Fetch ALL section data in parallel — no waterfall
  const dataResults = await Promise.all(
    sections.map(s => resolveSectionData(s.type, s.props, ctx))
  );

  // Map data back to section instances by id
  const sectionData = Object.fromEntries(
    sections.map((s, i) => [s.id, dataResults[i]])
  );

  return { sectionData, layout, store };
}
```

**Result:** A page with 5 widgets that each call the backend API fires all 5 API calls simultaneously. Total latency = slowest single API call, not sum of all calls.

---

## 8. Route → Layout Mapping

### Routing strategy: named routes + catch-all (industry standard)

This is the universal pattern used by Shopify, Next.js, Remix, SvelteKit, and every major framework at this layer. Named routes for known resource types, a catch-all at the bottom as a safety net only.

**Why not a single `app.get("*", ...)`?**
Your routes directly mirror your backend API's resource model — `/products/:handle` maps to `GET /api/products/:handle`, `/collections/:handle` to `GET /api/collections/:handle`, and so on. These are known, stable, typed resources. A single catch-all throws away structure that both Hono and the backend API already give you for free — you'd be re-deriving route type and params inside the handler yourself. Every major production codebase (Express, Fastify, Remix, Next.js) treats the single `*` handler as an anti-pattern beyond prototype stage.

The catch-all at the bottom exists for one reason: merchant-created custom pages that don't fit a known resource type. That's its entire job.

### Hono route definitions

All named routes point to the same `renderPage` handler — the difference is Hono extracts `c.req.param("handle")` cleanly so data resolvers receive typed params, not raw path strings.

```typescript
// routes/storefront.ts

// --- Storefront page routes (named, typed params) ---
app.get("/",                    renderPage)   // layout key: "home"
app.get("/products/:handle",    renderPage)   // layout key: "product"
app.get("/collections/:handle", renderPage)   // layout key: "collection"
app.get("/cart",                renderPage)   // layout key: "cart"
app.get("/pages/:handle",       renderPage)   // layout key: "page"
app.get("/search",              renderPage)   // layout key: "search"

// --- Cart API (called by HTMX, returns fragment or JSON) ---
app.post("/cart/add",           cartAdd)
app.post("/cart/update",        cartUpdate)
app.delete("/cart/item/:id",    cartRemove)

// --- Catch-all: merchant custom pages or 404 ---
// Safety net only — not the primary router
app.get("*",                    renderPage)
```

### Route → layout key → KV lookup

```typescript
// Each named route maps to a layout key used to fetch from KV
const ROUTE_LAYOUT_KEYS: Record<string, string> = {
  "/":             "home",
  "/cart":         "cart",
  "/search":       "search",
};

// Parameterised routes resolve by Hono's matched route pattern
// e.g. matched pattern "/products/:handle" → key "product"
function resolveLayoutKey(c: Context): string {
  const pattern = c.req.routePath;          // Hono gives matched pattern
  const segment = pattern.split("/")[1];    // "products", "collections", "pages"
  return segment?.replace(/s$/, "") ?? "custom"; // "product", "collection", "page"
}

// KV key: layouts:{store_id}:product     → layout JSON for /products/:handle
// KV key: layouts:{store_id}:collection  → layout JSON for /collections/:handle
// KV key: layouts:{store_id}:custom      → fallback for catch-all pages
```

---

## 9. HTMX Request Detection (Boosted Request Pattern)

No separate fragment routes. Every storefront route detects whether the request came from HTMX and responds accordingly — full HTML shell for browser requests, body content only for HTMX navigation swaps.

This is the pattern recommended by htmx.org when you control the server, and eliminates an entire category of routes.

### HTMX headers set automatically by the browser

| Header | Value | When |
|---|---|---|
| `HX-Request` | `"true"` | Any request made by HTMX |
| `HX-Boosted` | `"true"` | Navigation via `hx-boost` (link click) |
| `HX-Target` | element id | When `hx-target` is set |
| `HX-Trigger` | element id | The element that triggered the request |

### Middleware — detect and attach to context

```typescript
// middleware/htmx.ts
export const htmxMiddleware = async (c: Context, next: Next) => {
  c.set("isHtmx",   c.req.header("HX-Request") === "true");
  c.set("isBoosted", c.req.header("HX-Boosted") === "true");
  await next();
};
```

### Page renderer — one handler, two response shapes

```typescript
// renderer/page.ts
export async function renderPage(c: Context) {
  const store    = c.get("store");
  const layout   = await getLayout(store.store_id, c.req.routePath);
  const sections = await buildPageSections(c, store, layout);

  if (c.get("isHtmx")) {
    // HTMX navigation (hx-boost link click) —
    // browser already has <head> and shell, send body content only
    return c.html(await renderSections(sections));
  }

  // Direct browser request — send full HTML document
  return c.html(await renderShell(store, sections));
}
```

### Shell vs body-only response

```typescript
// renderer/shell.ts

// Full document — sent on first load / hard refresh
export async function renderShell(store: Store, sections: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${store.name}</title>
  <link rel="stylesheet" href="/styles/${store.id}.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
  <script src="https://unpkg.com/htmx.org@2/dist/htmx.min.js"></script>
</head>
<body hx-boost="true">
  ${sections}
</body>
</html>`;
}

// Body content only — sent on HTMX navigation
// HTMX swaps this into <body>, preserving <head> and loaded JS
export async function renderSections(sections: string) {
  return sections; // rendered section HTML, no shell
}
```

### What this eliminates

- No `/fragments/:section` route
- No duplicated data-fetching logic between page routes and fragment routes
- No client-side coordination of which endpoint to call — HTMX handles it transparently via headers
- Alpine.js re-initialises automatically on the new `<body>` content via its built-in `MutationObserver`

### Cart and targeted swaps (still need dedicated routes)

HTMX header detection covers **page navigation** (full body swap via `hx-boost`). Cart mutations and targeted partial swaps that POST data or update a specific element still use dedicated routes — but these are action endpoints, not page renderers:

```typescript
app.post("/cart/add",        cartAdd)     // returns updated cart fragment
app.post("/cart/update",     cartUpdate)  // returns updated cart fragment
app.delete("/cart/item/:id", cartRemove)  // returns updated cart fragment
```

These cart routes also check `HX-Request` to decide whether to return HTML fragment or JSON, depending on what the caller needs.

---

## 10. Multi-Tenant Server Architecture

```
                        ┌──────────────────────────────────┐
                        │     Cloudflare Global Network     │
                        │                                   │
  Browser ─────────────►│  CDN Cache (HTML, 8ms global)    │
                        │         │ miss                    │
                        │         ▼                         │
                        │  Worker (Hono, edge-native)       │
                        │    ├─ Tenant middleware           │
                        │    ├─ Route matcher               │
                        │    ├─ KV reads (layout/template) │
                        │    ├─ Parallel API fetches        │
                        │    ├─ Eta render + stream         │
                        │    └─ Fragment endpoints          │
                        │         │                         │
                        └─────────┼─────────────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    │             │              │
                    ▼             ▼              ▼
             Cloudflare KV   Backend API     Cloudflare R2
           (layout, template  (products,    (images, assets)
              strings)       orders, cart)
```

**Tenant isolation in this model:**
- Worker: isolated V8 per request — no memory shared between tenants
- KV: all keys prefixed with `store_id` — no cross-tenant access possible
- Backend API: `store_id` + `api_key` in every request header — backend enforces its own isolation
- HTML cache: cached per full URL including hostname — `mystore.com/` and `otherstore.com/` are separate cache entries

---

## 11. What the Builder Saves

The visual builder (Next.js) only writes two things to your system:

**1. Layout JSON** → via your Builder API → written to KV
```
PUT /api/layouts/{route}
Body: { slots: { ... } }
→ KV.put("layouts:{store_id}:{route}", JSON.stringify(layout))
```

**2. Section template strings** (only if merchant customizes a section)
```
PUT /api/sections/{type}
Body: { template: "<section>...</section>", schema: { ... } }
→ KV.put("sections:{store_id}:{type}", JSON.stringify({ template, schema }))
→ fnCache.delete("{store_id}:{type}")  ← invalidate compiled fn
```

Everything else — products, orders, settings — the builder reads from the backend API directly.

---

## 12. Summary — What Your System Owns

| Concern | Owner | Storage |
|---|---|---|
| Page structure (which widgets, which slots) | You | Cloudflare KV |
| Section HTML templates | You | Cloudflare KV |
| Compiled Eta functions | You | Worker in-memory Map |
| Rendered HTML cache | You | CF CDN + Redis |
| Products, collections, inventory | Backend team | Their DB |
| Orders, cart, checkout | Backend team | Their DB |
| Customers, auth | Backend team | Their DB |
| Store settings / merchant config | Backend team | Their DB (you cache a copy in KV) |
| Images, static assets | You (or shared) | Cloudflare R2 |
