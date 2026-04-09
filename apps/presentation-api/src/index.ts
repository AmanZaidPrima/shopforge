import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { getStoreByHostname, getStoreTheme } from "./storage/index.ts";
import themes from "./routes/themes.ts";
import store from "./routes/store.ts";
import layouts from "./routes/layouts.ts";

const app = new Hono();

// Allow editor (localhost:3003) to call this API
app.use("*", cors({ origin: ["http://localhost:3003", "http://localhost:3000"] }));

// Theme static files (CSS, .eta templates, schema.json)
app.use("/static/themes/*", serveStatic({ root: "./" }));

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Store resolution — returns store record + active theme in one call
app.get("/stores/resolve/:hostname", async (c) => {
  const hostname = c.req.param("hostname")!;
  const store = getStoreByHostname(hostname);

  if (!store) return c.json({ error: "Store not found" }, 404);

  const storeTheme = await getStoreTheme(store.id);
  return c.json({ store, storeTheme });
});

// Platform theme catalogue — public metadata
app.route("/themes", themes);

// Store-scoped presentation routes
app.route("/stores/:storeId/theme", store);
app.route("/stores/:storeId/layouts", layouts);

export default {
  port: 3001,
  fetch: app.fetch,
};
