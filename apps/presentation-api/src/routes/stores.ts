import { Hono } from "hono";
import { getStoreByHostname, getStoreTheme } from "../storage/index.ts";

const router = new Hono();

// GET /stores/resolve/:hostname
// Returns store record + active theme in one call — used by server tenant middleware.
router.get("/resolve/:hostname", async (c) => {
  const hostname = c.req.param("hostname")!;
  const store = getStoreByHostname(hostname);

  if (!store) return c.json({ error: "Store not found" }, 404);

  const storeTheme = await getStoreTheme(store.id);

  return c.json({ store, storeTheme });
});

export default router;
