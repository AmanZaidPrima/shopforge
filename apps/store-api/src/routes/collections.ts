import { Hono } from "hono";
import { collections } from "../fixtures/collections.ts";
import { products } from "../fixtures/products.ts";

const router = new Hono();

// GET /stores/:storeId/collections/:handle
router.get("/:handle", (c) => {
  const handle = c.req.param("handle")!;
  const collection = collections.find((col) => col.handle === handle) ?? null;
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const { productIds, ...meta } = collection;
  return c.json(meta);
});

// GET /stores/:storeId/collections/:handle/products?limit=N
router.get("/:handle/products", (c) => {
  const handle = c.req.param("handle")!;
  const limit = Number(c.req.query("limit")) || 12;

  const collection = collections.find((col) => col.handle === handle) ?? null;
  if (!collection) return c.json({ error: "Collection not found" }, 404);

  const collectionProducts = products
    .filter((p) => collection.productIds.includes(p.id))
    .slice(0, limit);

  return c.json(collectionProducts);
});

export default router;
