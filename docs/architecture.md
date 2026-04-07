# High-Performance Storefront Platform
## Architecture Reference & Build Guide

---

## 1. Finalized Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Bun (dev/prod server) | Fast startup, native TS, edge-portable |
| HTTP framework | Hono | Runs on Bun + Cloudflare Workers unchanged |
| Template engine | Eta | Async support, compiled+cached, 6× faster than LiquidJS |
| Browser interactivity | Alpine.js (~7KB) | Zero-build, sprinkled on SSR HTML |
| Partial updates | HTMX (~14KB) | Body swap nav + fragment cart updates |
| Layout storage | Cloudflare KV | Per-merchant layout JSON, instant invalidation |
| Fragment cache | Redis / CF KV | Compiled Eta functions + rendered HTML fragments |
| Static assets | Cloudflare R2 + CDN | Zero-egress images, 300+ edge nodes |
| Builder API | Hono (same codebase) | Save layout JSON, auth, merchant CRUD |
| Builder UI | Next.js / React | Visual drag-and-drop editor |

---

## 2. Template Engine Decision: Eta (Confirmed)

### Why not the alternatives

| Engine | Blocker |
|---|---|
| Mustache | Logic-less — no math, filters, async. Dealbreaker for data-fetching widgets |
| Handlebars | No async support — can't `await` inside templates |
| LiquidJS | 6× slower, 45KB bundle, edge-hostile |
| Plain template literals | No sandboxing, no include/partial support, XSS-prone without manual escaping |

### Eta syntax cheatsheet

```
<%= it.product.title %>         → escaped output
<%~ it.rawHtml %>               → unescaped output (trusted HTML only)
<% if (it.inStock) { %>         → logic block (no output)
<% } %>
<% for (const p of it.products) { %>
  <%= p.title %>
<% } %>
<%~ include('partials/price', { product: it.product }) %>   → partial
```

### Compile-once, call-many caching pattern

```typescript
// widget-renderer.ts
import { Eta } from "eta";

const eta = new Eta({ views: "./templates" });
const fnCache = new Map<string, Function>();

export async function renderWidget(
  slug: string,
  data: Record<string, unknown>
): Promise<string> {
  let fn = fnCache.get(slug);

  if (!fn) {
    const templateStr = await db.fetchTemplate(slug); // ~2–20ms, once ever
    fn = eta.compile(templateStr);                     // compile to JS fn
    fnCache.set(slug, fn);                             // cache forever (until redeploy)
  }

  return fn(data, eta.config);                         // ~0.005ms per call
}
```

**Cache invalidation:** On merchant publish, call `fnCache.delete(slug)` or restart the Worker instance. KV-stored layout JSON is invalidated separately via KV write.

---

## 3. DB Schema

### `stores`
```sql
CREATE TABLE stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname    TEXT UNIQUE NOT NULL,   -- e.g. "myshop.com", "store.myshop.com"
  name        TEXT NOT NULL,
  settings    JSONB NOT NULL DEFAULT '{}',  -- theme colors, fonts, currency
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_stores_hostname ON stores(hostname);
```

### `widgets`
```sql
CREATE TABLE widgets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID REFERENCES stores(id) ON DELETE CASCADE,
  slug         TEXT NOT NULL,             -- e.g. "product-card", "hero-banner"
  template     TEXT NOT NULL,             -- raw Eta template string
  schema       JSONB NOT NULL DEFAULT '{}', -- prop definitions for the builder
  version      INTEGER NOT NULL DEFAULT 1,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, slug)
);
```

### `pages`
```sql
CREATE TABLE pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE,
  route       TEXT NOT NULL,              -- "/", "/products/:handle", "/collections/:handle"
  layout      JSONB NOT NULL,             -- slot → [{ widget_slug, props, order }]
  published   BOOLEAN DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, route)
);
```

### Layout JSON shape
```json
{
  "slots": {
    "header": [
      { "widget": "site-header", "props": { "logoUrl": "/logo.svg" } }
    ],
    "main": [
      { "widget": "hero-banner", "props": { "heading": "Summer Sale", "ctaText": "Shop Now" } },
      { "widget": "product-grid", "props": { "collectionHandle": "featured", "limit": 8 } }
    ],
    "footer": [
      { "widget": "site-footer", "props": {} }
    ]
  }
}
```

---

## 4. Cloudflare Worker SSR Pipeline

### Request lifecycle

```
Browser
  │
  ▼
Cloudflare CDN ──(cache hit)──► return cached HTML (8ms)
  │ (miss)
  ▼
Cloudflare Worker (Hono)
  │
  ├─ 1. Extract hostname → fetch store record
  ├─ 2. Match route → fetch page layout JSON from KV
  ├─ 3. Resolve data dependencies per slot (parallel Promise.all)
  ├─ 4. Render each widget via Eta (compile-once cache)
  ├─ 5. Stitch slots into shell HTML
  └─ 6. Stream HTML to browser via TransformStream
```

### Core Worker handler

```typescript
// worker.ts
import { Hono } from "hono";
import { renderPage } from "./renderer";
import { getStore, getLayout } from "./kv";

const app = new Hono();

app.get("*", async (c) => {
  const hostname = new URL(c.req.url).hostname;

  const [store, layout] = await Promise.all([
    getStore(hostname),       // KV: store settings
    getLayout(hostname, c.req.path), // KV: page layout JSON
  ]);

  if (!store) return c.text("Store not found", 404);
  if (!layout) return c.text("Page not found", 404);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();

  renderPage({ store, layout, request: c.req.raw, writer, enc }).finally(() =>
    writer.close()
  );

  return new Response(readable, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

export default app;
```

### Streaming renderer

```typescript
// renderer.ts
import { renderWidget } from "./widget-renderer";
import { fetchSlotData } from "./data-fetcher";

const SHELL_TOP = (store: Store) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${store.name}</title>
  <link rel="stylesheet" href="/styles/${store.id}.css">
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
  <script src="https://unpkg.com/htmx.org@2/dist/htmx.min.js"></script>
</head>
<body hx-boost="true">`;

const SHELL_BOTTOM = `</body></html>`;

export async function renderPage({ store, layout, request, writer, enc }) {
  await writer.write(enc.encode(SHELL_TOP(store)));

  for (const [slot, widgets] of Object.entries(layout.slots)) {
    await writer.write(enc.encode(`<div data-slot="${slot}">`));

    const widgetData = await Promise.all(
      widgets.map(w => fetchSlotData(w.widget, w.props, { store, request }))
    );

    for (let i = 0; i < widgets.length; i++) {
      const html = await renderWidget(widgets[i].widget, widgetData[i]);
      await writer.write(enc.encode(html));
    }

    await writer.write(enc.encode(`</div>`));
  }

  await writer.write(enc.encode(SHELL_BOTTOM));
}
```

---

## 5. Section / Widget Model

### Widget contract
Every widget is a self-contained unit:
- **Template:** Eta string in DB
- **Schema:** JSON Schema for props (used by builder UI)
- **Data resolver:** A TypeScript function that fetches runtime data

```typescript
// data-fetcher.ts
const resolvers: Record<string, (props, ctx) => Promise<unknown>> = {
  "product-grid": async (props, { store }) => ({
    products: await fetchProducts(store.id, props.collectionHandle, props.limit),
    store,
  }),
  "hero-banner": async (props) => ({
    heading: props.heading,
    ctaText: props.ctaText,
    imageUrl: props.imageUrl,
  }),
  "site-header": async (_, { store, request }) => ({
    logo: store.settings.logoUrl,
    cartCount: getCartCount(request),  // from cookie
    nav: store.settings.navLinks,
  }),
};

export async function fetchSlotData(slug, props, ctx) {
  return resolvers[slug]?.(props, ctx) ?? props;
}
```

### Widget template example — product card
```html
<!-- widgets/product-card.eta -->
<article
  class="product-card"
  x-data="productCard(<%= it.product.id %>)"
>
  <a href="/products/<%= it.product.handle %>">
    <img
      src="<%= it.product.featuredImage %>"
      alt="<%= it.product.title %>"
      loading="lazy"
      width="400" height="400"
    >
    <h2><%= it.product.title %></h2>
    <p><%= it.product.price %></p>
  </a>
  <button @click="addToCart(<%= it.product.id %>)">Add to Cart</button>
</article>
```

---

## 6. HTMX Navigation Strategy

### Full body swap (page navigation)
`hx-boost="true"` on `<body>` upgrades all `<a>` tags automatically — intercepts clicks, fetches URL, swaps `<body>`, updates URL via History API. No full page reload.

**What gets preserved:** `<head>` CSS/JS stays loaded. Alpine re-initializes on new `<body>` content via `MutationObserver` (built into Alpine v3).

### Fragment swaps (cart, inventory, live data)

```typescript
// Fragment route — returns partial HTML, no shell
app.get("/fragments/:widget", async (c) => {
  const { widget } = c.req.param();
  const props = c.req.query();
  const store = await getStore(new URL(c.req.url).hostname);
  const data = await fetchSlotData(widget, props, { store, request: c.req.raw });
  const html = await renderWidget(widget, data);
  return c.html(html);
});
```

```html
<!-- Cart icon — updates count without page reload -->
<div
  id="cart-count"
  hx-get="/fragments/cart-count"
  hx-trigger="cartUpdated from:body"
  hx-swap="outerHTML"
>
  <span x-text="$store.cart.count">0</span>
</div>

<!-- Add to cart button — triggers cart update -->
<button
  hx-post="/cart/add"
  hx-vals='{"variantId": "<%= it.product.variantId %>"}'
  hx-on::after-request="htmx.trigger(document.body, 'cartUpdated')"
>
  Add to Cart
</button>
```

### Navigation decision tree
```
User action
    │
    ├─ Click <a> link        → hx-boost → body swap, URL pushState
    ├─ Add to cart           → hx-post /cart/add → trigger 'cartUpdated' → cart fragment re-fetches
    ├─ Variant select        → Alpine local state only (no server round-trip)
    └─ Stock check           → hx-get /fragments/stock-badge hx-trigger="load"
```

---

## 7. Alpine.js Scope Per Section

### Pattern: `x-data` per widget, `$store` for shared state

```html
<!-- Shell: initialize global stores -->
<script>
  document.addEventListener('alpine:init', () => {
    Alpine.store('cart', {
      count: 0,
      items: [],
      async add(variantId, qty = 1) {
        const res = await fetch('/cart/add', {
          method: 'POST',
          body: JSON.stringify({ variantId, qty }),
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        this.count = data.totalQty;
        this.items = data.items;
      }
    });
  });
</script>
```

```html
<!-- Product widget — isolated scope, reads shared store -->
<div x-data="{
  selectedVariant: '<%= it.product.defaultVariantId %>',
  quantity: 1
}">
  <select x-model="selectedVariant">
    <% for (const v of it.product.variants) { %>
      <option value="<%= v.id %>"><%= v.title %></option>
    <% } %>
  </select>

  <button @click="quantity = Math.max(1, quantity - 1)">−</button>
  <span x-text="quantity"></span>
  <button @click="quantity++">+</button>

  <button @click="$store.cart.add(selectedVariant, quantity)">Add to Cart</button>
</div>
```

Alpine v3 listens to DOM mutations natively — after HTMX swaps `<body>`, Alpine automatically initializes `x-data` on all new elements.

---

## 8. KV Layout Storage & Cache Invalidation

### KV key structure
```
stores:{hostname}              → store settings JSON
layouts:{hostname}:{route}     → page layout JSON
```
Compiled Eta functions are **not** stored in KV (not serializable). Store raw template strings in KV; keep compiled `fn` in Worker in-memory `Map`. On cold start, compile once from KV.

### Publish flow
```
Merchant clicks "Publish"
  → API validates layout JSON
  → KV.put(`layouts:${hostname}:${route}`, JSON.stringify(layout))
  → ~100ms KV global propagation
  → Next Worker request reads new layout → renders updated page
```

### KV helpers
```typescript
// kv.ts
export const getStore = (hostname) => env.KV.get(`stores:${hostname}`, "json");
export const getLayout = (hostname, path) => env.KV.get(`layouts:${hostname}:${path}`, "json");
export const putLayout = (hostname, path, layout) =>
  env.KV.put(`layouts:${hostname}:${path}`, JSON.stringify(layout));
```

---

## 9. Performance Targets

| Metric | Shopify | Our Target | How |
|---|---|---|---|
| TTFB | 300–800ms | 30–80ms | Edge Worker + streaming, no origin round-trip |
| LCP | 2.5–4s | 0.8–1.5s | SSR HTML (no hydration), inline critical CSS, `loading=lazy` below fold |
| CLS | 0.1–0.3 | ~0 | Server-rendered dimensions on all images |
| TBT | 300–900ms | 0–20ms | No JS on critical path; Alpine deferred, HTMX tiny |
| Total JS | 180KB+ | ~21KB | Alpine 7KB + HTMX 14KB, zero framework bundle |

### Critical path for LCP
1. Worker at edge → HTML starts streaming in <30ms
2. `<head>` contains inline critical CSS (above-fold only)
3. LCP image has `fetchpriority="high"` + exact dimensions (no CLS)
4. Alpine/HTMX loaded with `defer` — never on critical path
5. No hydration, no JS execution before first paint

---

## 10. Build Steps

### File structure (target)
```
src/
  renderer/
    eta.ts          ← Eta instance + compile cache
    widget.ts       ← renderWidget(slug, data)
    data-fetcher.ts ← per-widget data resolvers
    page.ts         ← renderPage(store, layout) → streaming HTML
  kv.ts             ← KV read/write helpers
  worker.ts         ← Hono app + route handlers
  fragments.ts      ← /fragments/:widget route
```

### Hono routes to implement
- `GET *` → SSR page renderer
- `GET /fragments/:widget` → partial HTML for HTMX
- `POST /cart/add` → update cart cookie → return JSON
- `GET /cart/count` → fragment for cart badge
- Builder API routes (protected, builder subdomain only)

### First 5 widgets
1. `site-header` — logo, nav, cart badge
2. `hero-banner` — heading, image, CTA
3. `product-grid` — fetches products, renders cards
4. `product-card` — title, image, price, add-to-cart
5. `site-footer` — links, copyright

### Multi-tenancy smoke test
- Two stores in KV with different layouts
- Single Worker codebase serves both by hostname
- Verify layout isolation, no store data leakage
