import { Hono } from "hono";
import { products } from "../fixtures/products.ts";

const router = new Hono();

// GET /stores/:storeId/products?limit=N
router.get("/", (c) => {
  const limit = Number(c.req.query("limit")) || products.length;
  return c.json(products.slice(0, limit));
});

// GET /stores/:storeId/products/:handle
router.get("/:handle", (c) => {
  const handle = c.req.param("handle")!;
  const product = products.find((p) => p.handle === handle) ?? null;
  if (!product) return c.json({ error: "Product not found" }, 404);
  return c.json(product);
});

export default router;
