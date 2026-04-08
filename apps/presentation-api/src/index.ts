import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { getStoreByHostname, getStoreTheme } from "./storage/index.ts";
import themes from "./routes/themes.ts";
import store from "./routes/store.ts";
import layouts from "./routes/layouts.ts";

const app = new Hono();

// Theme static files (CSS, .eta templates, schema.json)
app.use("/static/themes/*", serveStatic({ root: "./" }));

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Store resolution — explicit static route registered before any parameterized /stores/* routes
// Returns store record + active theme in one call for server tenant middleware
app.get("/stores/resolve/:hostname", async (c) => {
  const hostname = c.req.param("hostname")!;
  const store = getStoreByHostname(hostname);

  if (!store) return c.json({ error: "Store not found" }, 404);

  const storeTheme = await getStoreTheme(store.id);
  return c.json({ store, storeTheme });
});

// Platform theme catalogue — public metadata
app.route("/themes", themes);

// Store-scoped presentation routes — storeId comes from URL path
app.route("/stores/:storeId/theme", store);
app.route("/stores/:storeId/layouts", layouts);

export default {
  port: 3001,
  fetch: app.fetch,
};
