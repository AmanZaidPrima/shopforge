import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { AppEnv } from "./types.ts";
import { htmxMiddleware } from "./middleware/htmx.ts";
import { tenantMiddleware } from "./middleware/tenant.ts";
import { renderPage } from "./renderer/page.ts";

const app = new Hono<AppEnv>();

// Middleware
app.use("*", tenantMiddleware);
app.use("*", htmxMiddleware);

// Static assets (theme CSS, etc.)
app.use("/static/*", serveStatic({ root: "./" }));

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
