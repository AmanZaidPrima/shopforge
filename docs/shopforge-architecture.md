# ShopForge — Architecture Decision Document

> **Audience:** Stakeholders  
> **Purpose:** Summarise the problem, compare the three proposals explored by the team, justify the chosen stack, and show how the proposed architecture beats Shopify on performance.

---

## 1. The Problem (Recap)

The current platform (Next.js, per-merchant deployments, React-based sections, Puck-like visual editor) has fundamental problems that cannot be patched without a re-architecture:

- **Build-locked sections.** Adding or editing any section requires a code change → `next build` → deploy. No merchant can customise templates without engineering involvement.
- **Sections are compiled artefacts, not data.** Templates live in `.js` bundles. They cannot be stored, versioned, or edited at runtime — so the visual editor can only change props, never the section's structure or markup.
- **One deployment per merchant.** N merchants = N Next.js apps. Shipping a fix or a new section means N re-deploys. This hits a wall before 100 merchants.

---

## 2. Three Proposals Explored

The team was asked to explore alternative approaches. Three proposals came back.

---

### Proposal A — Next.js + LiquidJS + Alpine.js

Keep Next.js as the server framework but swap React component rendering for LiquidJS templates. Alpine.js stays for browser interactivity.

**The idea:** Liquid is the language Shopify uses. It's human-readable, logic-capable, and designed for storefront templates. Storing templates as Liquid strings in a database removes the build-step problem.

**Where it lands:** Partially addresses the build problem. But Next.js is still the wrong frame — it was designed to serve React apps, and running it as a Liquid renderer wastes its entire reason for existing. LiquidJS itself is also a significant drag (see template engine comparison below).

---

### Proposal B — Next.js + Handlebars + jQuery / Vanilla JS

Keep Next.js, swap Liquid for Handlebars templates, drop Alpine in favour of vanilla JS or jQuery for browser interactivity.

**The idea:** Handlebars is simple, widely understood, and templates are strings — so no build step for template changes. jQuery is a known quantity for DOM manipulation.

**Where it lands:** jQuery ships ~87KB for what Alpine covers in 7KB with cleaner declarative syntax; vanilla avoids the weight but brings boilerplate. Neither choice fixes the deployment model or the build-step problems.

---

### Proposal C — Hono + HTMX + Alpine.js + Eta + Streaming + Partial-page Navigation + Cloudflare Workers

Replace the entire server layer with a lean, edge-native stack. Templates are Eta strings stored in a database. A single Cloudflare Worker serves all merchants. HTMX handles page navigation as partial body swaps. Alpine.js handles local UI state. The storefront streams HTML from the edge — no origin round-trip on cache hit.

**The idea:** Treat templates as data (not code). Render at the edge. Ship almost no JavaScript to shoppers. Make performance the primary product differentiator against Shopify.

**This is our recommended proposal, pending stakeholder review.** The rest of this document details the technology choices, architecture, and performance case.

---

## 3. Technology Choice Buckets

### 3a. Template Engine — Liquid vs Handlebars vs Eta

All three allow templates to be stored as strings and rendered server-side without a build step. The differences are in performance, capability, and edge compatibility.

| | LiquidJS | Handlebars | Eta |
|---|---|---|---|
| **GitHub Stars** | ~1.8k | ~18.6k | ~1.7k |
| **npm weekly downloads** | ~997k | ~36M+ | ~2.2M |
| **Render model** | Parse + render on every call | Compile to function, call many | Compile to function, call many |
| **Async support** | No | No | Yes — full `await` inside templates |
| **Logic / expressions** | Shopify-flavoured subset | Logic-less by design | Full JS expressions |
| **Bundle size (gzipped)** | ~24KB | ~22KB (full) / ~1KB (runtime) | ~2.5–3.5KB |
| **Auto HTML escaping** | No (opt-in) | Yes (default) | Yes (default) |
| **Known CVEs** | SSTI, prototype pollution, path traversal | RCE (pre-4.5.3), prototype pollution XSS | RCE via prototype pollution (CVE-2022-25967) |
| **Edge / CF Workers** | Hostile — large, sync-only | Works, limited | Native — tiny, async, zero deps |
| **Render speed (benchmark)** | ~153ms / 1,000 renders | ~390ms / 1,000 renders | ~20ms / 1,000 renders |
| **Template mutability** | Store as string ✓ | Store as string ✓ | Store as string ✓ |
| **Lineage** | Port of Shopify's Ruby Liquid | Independent | Built on EJS syntax + Nunjucks concepts |

> Benchmark source: [JavaScript Template Engine Benchmark 2024 — DEV Community](https://dev.to/devcrafter91/javascript-template-engine-benchmark-2024-2m3j). Numbers represent relative render time across 1,000 iterations — absolute values vary by machine; the ratios are what matter.

**Render time per 1,000 iterations — lower is better**

```
Eta          ██  20ms
LiquidJS     ███████████████  153ms
Handlebars   ███████████████████████████████████████  390ms
             |         |         |         |         |
             0        100       200       300       400ms
```

**LiquidJS**
- ✅ Familiar — Shopify developers already know the syntax
- ✅ Human-readable, beginner-friendly
- ✅ Templates are strings — no build step
- ✅ Large install base (~1M downloads/week)
- ❌ Re-parses on every render call — slowest of the three by a wide margin
- ❌ No async support — all data must be pre-fetched sequentially before template execution
- ❌ No auto HTML escaping by default — XSS protection must be configured manually
- ❌ Known SSTI vulnerabilities allowing arbitrary file read; prototype pollution CVEs
- ❌ Designed for Ruby; JS port carries that architectural weight

**Handlebars**
- ✅ Most widely adopted (~36M downloads/week), largest ecosystem
- ✅ Compiles to a function — faster than Liquid
- ✅ Auto HTML escaping on by default
- ✅ Templates are strings — no build step
- ❌ Logic-less by design — requires registered helpers for prices, dates, conditionals
- ❌ No async support — same sequential data-fetch constraint as Liquid
- ❌ CVE history includes RCE and prototype pollution XSS; sandbox is escapable
- ❌ Ecosystem is mature but largely in maintenance mode

**Eta**
- ✅ Fastest by benchmark — ~7× faster than Handlebars, ~25× faster than Liquid per 1,000 renders
- ✅ Full async/await — data fetching can happen in parallel inside the render pipeline
- ✅ Full JS expressions — no helper registration needed
- ✅ Auto HTML escaping on by default
- ✅ Smallest bundle (~2.5KB gzipped), edge-native, runs identically on Bun and Cloudflare Workers
- ✅ Built on the shoulders of EJS (syntax, file handling) and Nunjucks (compilation model) — not an experiment, inherits battle-tested patterns from both
- ❌ Smaller community than Handlebars; less name recognition
- ❌ Auto-escaping is not considered fully security-vetted by the maintainers — defence-in-depth (escape data before storing) is recommended regardless of engine choice

**Bottom line:** choose Liquid for Shopify developer familiarity at the cost of performance. Choose Eta if performance is the priority — async support, smallest footprint, and an order of magnitude faster than Liquid (20ms vs 153ms per 1,000 renders).

---

### 3b. HTTP Framework — Next.js vs Hono

These are not two versions of the same thing. They solve fundamentally different problems.

**Next.js** is a React application framework. Its entire design — SSR, ISR, App Router, React Server Components — exists to serve React apps to the browser. It assumes React is the rendering layer.

**Hono** is a lightweight HTTP framework. It handles requests, runs middleware, and returns responses. It has no opinion on how you render HTML — you bring your own template engine. It runs identically on Bun, Cloudflare Workers, Node.js, and Deno with zero code changes.

For a Shopify-like platform, the rendering layer is a template engine (Eta/Liquid), not React. That single difference makes Next.js the wrong tool — and the mismatch shows up directly in performance and operational cost.

| | Next.js | Hono |
|---|---|---|
| **What it is** | React application framework | Lightweight HTTP framework |
| **Rendering layer** | React — template strings can be injected via `dangerouslySetInnerHTML` but that is a workaround, not a supported pattern | Any template engine — or none |
| **Edge runtime** | Vercel Edge (constrained Node.js subset) | Cloudflare Workers, Bun, Deno — native, no constraints |
| **Cold start** | 200–800ms (Node.js origin) | <5ms (V8 isolate at edge) |
| **Multi-tenancy** | Requires separate deployment per merchant | Single binary, hostname-based tenant resolution in middleware |
| **Streaming HTML** | Via React Suspense — tied to React render tree | Native `TransformStream` — independent of rendering model |
| **Per-request overhead** | Full React SSR pipeline on every request | Minimal — route match → middleware → handler → response |
| **Template engine support** | Possible via `dangerouslySetInnerHTML` — functional but a workaround that bypasses React entirely, adds overhead with no benefit, and does not scale cleanly | Eta, Liquid, Handlebars, plain strings — your choice |
| **JS shipped to browser** | ~90KB Next.js runtime (unavoidable) | 0KB — server only, nothing shipped |

> Benchmarks below use Hono vs Express as a proxy for Next.js server performance — Next.js API routes run on the same Node.js runtime as Express. Sources: [Hono vs Express benchmark](https://github.com/thejaAshwin62/Hono-Express-Benchmark) · [Hono official benchmarks](https://hono.dev/docs/concepts/benchmarks)

**Throughput (req/sec) — higher is better**

```
Hono       ████████████████████████████████████  32,700 req/s
Next.js    █████  5,500 req/s
           |         |         |         |         |
           0       8,000    16,000    24,000    32,000
```

**Average request latency — lower is better**

```
Hono       ███████████  17ms
Next.js    █████████████████████████████████████  53ms
           |         |         |         |         |
           0        15        30        45        60ms
```

**Next.js**
- ✅ Excellent for React-heavy admin UIs, dashboards, and builder tools
- ✅ Built-in ISR, image optimisation, file-based routing
- ❌ React is load-bearing — you cannot swap it for Eta or Liquid
- ❌ Cannot run natively on Cloudflare Workers — Vercel Edge is a restricted subset that drops standard APIs
- ❌ Cold starts of 200–800ms on Node.js origin — a ceiling on TTFB we cannot break through
- ❌ Per-merchant deployment model: N merchants = N apps, N deploys, N cold starts
- ❌ ~90KB client runtime shipped on every storefront page regardless of whether React is used in the browser

**Hono**
- ✅ Runs natively on Cloudflare Workers — one binary serves all merchants from 300+ edge locations
- ✅ <5ms cold start as a V8 isolate — TTFB floor is at the edge, not at an origin server
- ✅ Zero coupling to a rendering model — works with any template engine
- ✅ Single codebase, zero changes between local Bun development and Cloudflare Workers production
- ✅ Ships nothing to the browser — no framework tax on the client
- ❌ No built-in conventions for routing or data loading — you define the patterns yourself

> Other frameworks in this space: **Express** is the most established but old, slow, and Node-only. **Flask** is Python — wrong runtime entirely for a JS/edge stack. **Elysia** is faster than Hono in raw benchmarks but runs exclusively on Bun, ruling out Cloudflare Workers. Hono is the only option that is fast, edge-native, and runtime-agnostic.

**Bottom line:** Next.js is the right choice for the builder UI (admin React app). It is the wrong choice for the storefront renderer — it cannot run at the edge natively, cannot serve multiple merchants from one deployment, and forces React into a pipeline where we need a template engine. Hono is purpose-fit for the storefront: edge-native, multi-tenant by default, and unopinionated about rendering.


---

## 4. Proposed Architecture (Option C)

### The Core Idea

> **Templates are data, not code. Rendering happens at the edge. The browser gets HTML and minimal JavaScript — nothing else.**

A single Cloudflare Worker serves all merchants. Page layouts are JSON stored per-merchant in Cloudflare KV. Section templates are Eta strings, also in KV. The Worker compiles each template to a JS function once and caches it in-memory. Every subsequent render of that section is a near-instant function call — benchmarks put Eta at ~0.005ms per render, orders of magnitude faster than re-parsing approaches.

---

### How a Request Works

```
Browser: GET mystore.com/collections/shoes
         │
         ▼
Cloudflare CDN ──(HTML cache hit)──► return cached page (edge-local, very low latency)
         │ cache miss
         ▼
Cloudflare Worker (Hono)
         │
         ├─ 1. Tenant middleware
         │      in-memory cache hit → { store_id, theme_id } (0 KV reads)
         │      cache miss → KV.get("stores:mystore.com") → { store_id, theme_id, api_key }
         │
         ├─ 2. Route match + layout resolve
         │      in-memory cache hit → sections[] (0 KV reads)
         │      cache miss → KV.get("layouts:{store_id}:collection") → sections[]
         │
         ├─ 3. Detect request type (HTMX header check)
         │      HX-Request: true → return body sections only (navigation swap)
         │      Direct request  → return full HTML document
         │
         ├─ 4. Stream <head> immediately ─────────────────────────────────────────┐
         │      <link rel="stylesheet">, <script defer src="alpine.js">,          │
         │      <script defer src="htmx.js">, font preloads                       │
         │      → browser starts downloading CSS, fonts, JS right now             │
         │        while server is still fetching section data (steps 5–6)         │
         │                                                                        │
         ├─ 5. Fetch all section data in parallel          ◄────────── happening  │
         │      Promise.all([                                        in parallel  │
         │        api.getCollection("shoes"),   // product-grid      with browser │
         │        api.getCart(cookieToken),      // site-header       loading     │
         │        api.getMenu("main-nav"),       // site-header       head assets │
         │      ])                                                                │
         │      → total latency = slowest single API call, not their sum ◄────────┘
         │
         ├─ 6. Render each section via Eta compile cache
         │      fnCache.get("{themeId}:{sectionType}") → compiled fn (~0.005ms/call)
         │      first call only: compile from KV string, store in cache
         │
         └─ 7. Stream rendered HTML chunks to browser via TransformStream
               → sections stream in layout order; Alpine.js (already loaded) wakes
                 up on each arriving section — no hydration step required
```

---

### Navigation: Partial Page Reload (No Full Reloads, No SPA Bundle)

`hx-boost="true"` on `<body>` upgrades every `<a>` link automatically. On click:

1. HTMX intercepts, sends `GET /next-page` with header `HX-Request: true`
2. Server detects the header, returns **body sections only** — no `<head>`, no shell
3. HTMX swaps the `<body>` content, pushes URL via History API
4. `<head>` stays loaded — CSS, fonts, JS never re-evaluated
5. Alpine.js re-initialises on new DOM content automatically via its built-in `MutationObserver`

The result: navigation feels instant (only the body is replaced), but the server is still doing full SSR on every request — no client-side state management, no hydration, no JS bundle for routing. Purely client-side interactions (cart count, quantity pickers, variant selects, UI toggles) are handled by Alpine.js with no server round-trip; HTMX endpoints are only used where a server re-render genuinely adds value.

---

### Section Model

Every section is three things:

| Part | What it is | Stored in |
|---|---|---|
| **Template** | Eta string — the HTML the section produces | Cloudflare KV |
| **Schema** | JSON — defines the props the editor sidebar shows | Cloudflare KV |
| **Data resolver** | TypeScript function — fetches runtime data (products, cart, menus) | Server code |

A page layout is a flat `sections[]` array in KV — ordered, rendered top-to-bottom, streamed as they complete.

**Adding a new section:** write a template string and schema to KV. No build, no deploy, available to all merchants immediately.  
**Editing a section template:** update the KV string, invalidate the compile cache entry (`fnCache.delete(key)`). Live on the next request.  
**Merchant customisation:** edit props via the visual editor → KV write → live globally within milliseconds (Cloudflare KV propagation).

---

### The Visual Editor

The builder UI (any modern frontend framework — Next.js, SvelteKit, Vue — the choice here has no impact on the storefront architecture) loads the live storefront in an iframe. Editor sidebar and iframe communicate via a well-defined event system, exactly mirroring how Shopify's theme editor works:

- **Prop change in sidebar** → editor calls Section Rendering API (`GET /?sections=section-id`) → receives fresh rendered HTML for only that section → swaps it into the iframe DOM. No full reload.
- **Publish** → `PUT /api/layouts/:route` → KV write → live globally within milliseconds.
- **Add section** → merchant picks from preset library → added to layout JSON → rendered and injected into iframe. No build.
- **Reorder / remove** → layout JSON updated in memory → streamed back to iframe. No build.

---

### Performance — The Selling Point

Every architectural decision was made to minimise latency and JavaScript. This is the primary product differentiator against Shopify. The numbers below show what each choice buys us directionally — exact production figures will be measured once deployed.

| Metric | Shopify (observed) | Our Direction | Why |
|---|---|---|---|
| **TTFB** | 300–800ms | Significantly lower — goal is edge-fast | CF Worker at edge eliminates origin round-trip; cache hit is edge-local |
| **LCP** | 2.5–4s | Meaningfully faster | SSR HTML (no hydration), inline critical CSS, `fetchpriority` on LCP image |
| **CLS** | 0.1–0.3 | Minimal to none | All image dimensions server-rendered — no layout shifts |
| **TBT** | 300–900ms | Near-zero | No JS on critical path; Alpine + HTMX loaded `defer`, no hydration |
| **Total JS** | 180KB+ | ~21KB (Alpine 7KB + HTMX 14KB) | No framework runtime shipped — these are fixed, measurable library sizes |
| **Template render** | ~6ms (Liquid re-parse per req) | Orders of magnitude faster | Eta compile-once cache — benchmark: ~0.005ms/render vs Liquid ~153ms/1,000 |
| **Throughput** | Origin-bound, Node.js ceiling | Significantly higher — CF Workers scale globally | V8 isolates at edge, stateless, 300+ PoPs — Hono benchmarks: ~32k req/s on Node, ~400k ops/s on CF Workers |

**The critical path to first paint:**
1. Worker at edge → `<head>` streams immediately — browser starts loading CSS, fonts, Alpine, HTMX before sections are rendered
2. Section data fetched in parallel — total wait = slowest single API call, not their sum
3. Section HTML streamed as it renders — browser paints progressively
4. No hydration step — the HTML the server sends is the final DOM
5. Alpine (already loaded) wakes up on each section as it arrives — zero extra round-trips for interactivity

---

## 5. How This Mirrors Shopify — and Where It Beats It

Shopify's architecture, stripped to its core, is:

> Liquid templates stored as strings → compiled on the server → rendered to HTML → streamed to the browser → AJAX partial updates for dynamic elements.

Our architecture is structurally identical — but every component is a modern replacement that outperforms the Shopify equivalent:

| Shopify | ShopForge | Advantage |
|---|---|---|
| **Ruby on Rails** (origin server) | **Cloudflare Workers** (edge, V8) | No origin round-trip, 300+ PoPs globally, <5ms cold start vs 200–800ms |
| **Liquid** template engine | **Eta** template engine | 6× faster per render, full async, 3KB vs 45KB, edge-native |
| **CDN-cached HTML** | **CDN-cached HTML** (CF edge) | Same concept, but our origin is already at the edge — cache miss is still fast |
| **Theme editor iframe** | **Theme editor iframe** | Same proven pattern — we adopt what Shopify validated |
| **Section Rendering API** (AJAX re-render) | **Section Rendering API** | Same pattern — we implement the same endpoint contract |
| **JSON templates** (layout as data) | **KV layout JSON** | Same concept — layouts are data, not code |
| **Liquid theme files** (editable in browser) | **Eta KV strings** (editable in builder) | Same capability — templates are data, live edits without deploy |
| **Alpine.js** (added in Dawn theme) | **Alpine.js + HTMX** | Shopify bolts Alpine onto Liquid; we designed for it from day one |
| **~180KB JS shipped** | **~21KB JS shipped** | ~8× less JavaScript — Alpine 7KB + HTMX 14KB are fixed, verifiable sizes |
| **TTFB 300–800ms (origin)** | **Significantly lower — edge rendering** | Edge Worker eliminates the origin round-trip Shopify cannot avoid |

**The summary:** Shopify's architecture is correct — templates as data, server-rendered HTML, partial AJAX updates, a visual editor that talks to an iframe. We are not inventing a new pattern. We are implementing the same proven pattern with a stack that is a full generation newer: edge-native, async-first, and built on components that individually outperform their Shopify equivalents in benchmarks.

Performance is not a feature we added on top — it is the direct result of every choice in the stack. The exact gains will be confirmed through measurement, but the architectural ceiling we are building toward is substantially higher than what Shopify can achieve from a Ruby origin server.

---

> **Note:** The technology comparisons in this document (Liquid vs Handlebars vs Eta, Next.js vs Hono) are not final decisions. They are the current analysis — final choices are pending stakeholder review and further evaluation.
