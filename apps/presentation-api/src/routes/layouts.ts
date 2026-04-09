import { Hono } from "hono";
import type { PageLayout } from "../types.ts";
import { getStoreTheme, getLayoutOverride, putLayoutOverride, deleteLayoutOverride, getThemeSchema } from "../storage/index.ts";

const layouts = new Hono();

// GET /stores/:storeId/layouts/:routeKey
// Returns override if set, otherwise falls back to theme default.
layouts.get("/:routeKey", async (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;

  const storeTheme = getStoreTheme(storeId);
  if (!storeTheme) return c.json({ error: "Store not found" }, 404);

  const override = getLayoutOverride(storeId, routeKey);
  if (override) return c.json({ source: "override", layout: override });

  const schema = await getThemeSchema(storeTheme.theme_id);
  const defaultLayout = schema?.default_layouts[routeKey] ?? null;

  if (!defaultLayout) return c.json({ error: "No layout for route" }, 404);

  return c.json({ source: "theme_default", layout: defaultLayout });
});

// PUT /stores/:storeId/layouts/:routeKey
layouts.put("/:routeKey", async (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;
  const layout = await c.req.json<PageLayout>();

  if (!Array.isArray(layout.sections)) {
    return c.json({ error: "Invalid layout: sections array required" }, 400);
  }

  if (!getStoreTheme(storeId)) return c.json({ error: "Store not found" }, 404);

  putLayoutOverride(storeId, routeKey, layout);

  return c.json({ saved: true, routeKey, layout });
});

// DELETE /stores/:storeId/layouts/:routeKey — revert to theme default
layouts.delete("/:routeKey", async (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;

  deleteLayoutOverride(storeId, routeKey);

  return c.json({ deleted: true, routeKey });
});

export default layouts;
