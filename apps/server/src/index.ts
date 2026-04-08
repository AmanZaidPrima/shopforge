import { Hono } from "hono";
import type { AppEnv } from "./types.ts";
import { htmxMiddleware } from "./middleware/htmx.ts";
import { tenantMiddleware } from "./middleware/tenant.ts";
import { renderPage } from "./renderer/page.ts";

const app = new Hono<AppEnv>();

// Middleware
app.use("*", tenantMiddleware);
app.use("*", htmxMiddleware);

// Proxy theme static assets (CSS, templates) to apps/api
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001";
app.use("/static/themes/*", (c) =>
  fetch(`${API_BASE}${new URL(c.req.url).pathname}`)
);

// Storefront routes
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/", (c) => renderPage(c, "home"));
app.get("/products/:handle", (c) => renderPage(c, "product", { handle: c.req.param("handle") }));
app.get("/collections/:handle", (c) => renderPage(c, "collection", { handle: c.req.param("handle") }));
app.get("/cart", (c) => renderPage(c, "cart"));
app.get("/pages/:handle", (c) => renderPage(c, "page", { handle: c.req.param("handle") }));

// Cart action
app.post("/cart/add", async (c) => {
  return c.json({ success: true, count: 1 });
});

// Catch-all
app.get("*", (c) => renderPage(c, "home"));

export default {
  port: 3000,
  fetch: app.fetch,
};
