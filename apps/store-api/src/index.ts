import { Hono } from "hono";
import products from "./routes/products.ts";
import collections from "./routes/collections.ts";
import pages from "./routes/pages.ts";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

// All routes are store-scoped — storeId reserved for Phase 2 tenant isolation
app.route("/stores/:storeId/products", products);
app.route("/stores/:storeId/collections", collections);
app.route("/stores/:storeId/pages", pages);

export default {
  port: 3002,
  fetch: app.fetch,
};
