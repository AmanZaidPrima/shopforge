import { Hono } from "hono";
import type { Page } from "../types.ts";

// Phase 1: fixture content pages. Phase 2: replace with DB/CMS.
const pages: Record<string, Page> = {
  about: {
    handle: "about",
    title: "About Us",
    content:
      "We believe in the beauty of simplicity. Our carefully curated collection brings you timeless essentials that stand the test of time.",
  },
  contact: {
    handle: "contact",
    title: "Contact",
    content: "Have a question? Reach us at hello@store.com. We respond within 24 hours.",
  },
};

const router = new Hono();

// GET /stores/:storeId/pages/:handle
router.get("/:handle", (c) => {
  const handle = c.req.param("handle")!;
  const page = pages[handle] ?? null;
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json(page);
});

export default router;
