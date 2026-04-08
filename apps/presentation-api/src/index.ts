import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import themes from "./routes/themes.ts";
import stores from "./routes/stores.ts";
import store from "./routes/store.ts";
import layouts from "./routes/layouts.ts";

const app = new Hono();

// Theme static files (CSS, .eta templates, schema.json)
app.use("/static/themes/*", serveStatic({ root: "./" }));

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Platform theme catalogue — public metadata
app.route("/themes", themes);

// Store resolution — used internally by server tenant middleware
app.route("/stores", stores);

// Store-scoped presentation routes — storeId comes from URL path
app.route("/stores/:storeId/theme", store);
app.route("/stores/:storeId/layouts", layouts);

export default {
  port: 3001,
  fetch: app.fetch,
};
