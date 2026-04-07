
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

---

## Project: High-Performance Storefront Platform

**Full architecture reference:** `docs/architecture.md`

### Stack
- **Runtime:** Bun + Hono (same codebase targets Bun dev server and Cloudflare Workers)
- **Templates:** Eta — compile-once, cache in `Map<slug, fn>`, ~0.005ms/render
- **Frontend:** Alpine.js (7KB) for local state + HTMX (14KB) for partial updates — no build step
- **Storage:** Cloudflare KV for layout JSON and store settings; Postgres (`Bun.sql`) for widgets/pages
- **Builder UI:** Separate Next.js app (not in this repo)

### Core patterns
- **Multi-tenancy by hostname:** `hostname → store → layout JSON → render`
- **Widget model:** each widget has an Eta template (in DB), a JSON schema (for builder), and a data resolver function
- **SSR pipeline:** Hono worker → fetch store + layout from KV → `Promise.all` data per slot → stream HTML via `TransformStream`
- **HTMX navigation:** `hx-boost="true"` on `<body>` for SPA-like nav; `/fragments/:widget` routes for targeted updates (cart, stock)
- **Alpine scope:** `x-data` per widget (isolated), `Alpine.store('cart', ...)` for shared state

### KV key structure
```
stores:{hostname}           → store settings JSON
layouts:{hostname}:{route}  → page layout JSON (slots → widgets)
```

### Performance targets
- TTFB: 30–80ms (vs Shopify 300–800ms)
- Total JS: ~21KB (Alpine + HTMX only)
- No hydration, no framework bundle, SSR-first
