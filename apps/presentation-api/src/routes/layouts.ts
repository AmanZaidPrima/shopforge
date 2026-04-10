import { Hono } from "hono";
import type { PageLayout } from "../types.ts";
import {
  getStoreTheme,
  getLayoutOverride,
  getDraftLayoutOverride,
  putDraftLayoutOverride,
  publishDraftLayout,
  deleteLayoutOverride,
  getThemeSchema,
} from "../storage/index.ts";

const layouts = new Hono();

// GET /stores/:storeId/layouts/:routeKey
// ?draft=1 → returns draft if one exists, then falls back to published, then theme default
// (no ?draft) → returns published override or theme default (what shoppers see)
layouts.get("/:routeKey", async (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;
  const draft = c.req.query("draft") === "1";

  const storeTheme = getStoreTheme(storeId);
  if (!storeTheme) return c.json({ error: "Store not found" }, 404);

  if (draft) {
    const draftOverride = getDraftLayoutOverride(storeId, routeKey);
    if (draftOverride) return c.json({ source: "draft", layout: draftOverride });
  }

  const override = getLayoutOverride(storeId, routeKey);
  if (override) return c.json({ source: "override", layout: override });

  const schema = await getThemeSchema(storeTheme.theme_id);
  const defaultLayout = schema?.default_layouts[routeKey] ?? null;

  if (!defaultLayout) return c.json({ error: "No layout for route" }, 404);

  return c.json({ source: "theme_default", layout: defaultLayout });
});

// PUT /stores/:storeId/layouts/:routeKey
// Saves to draft only — does not affect the live storefront.
layouts.put("/:routeKey", async (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;
  const layout = await c.req.json<PageLayout>();

  if (!Array.isArray(layout.sections)) {
    return c.json({ error: "Invalid layout: sections array required" }, 400);
  }

  if (!getStoreTheme(storeId)) return c.json({ error: "Store not found" }, 404);

  putDraftLayoutOverride(storeId, routeKey, layout);

  return c.json({ saved: true, draft: true, routeKey });
});

// POST /stores/:storeId/layouts/:routeKey/publish
// Promotes the current draft to live. No-op if no draft exists.
layouts.post("/:routeKey/publish", (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;

  const published = publishDraftLayout(storeId, routeKey);
  if (!published) return c.json({ error: "No draft to publish for this route" }, 404);

  return c.json({ published: true, routeKey });
});

// DELETE /stores/:storeId/layouts/:routeKey — revert published to theme default
layouts.delete("/:routeKey", (c) => {
  const storeId = c.req.param("storeId")!;
  const routeKey = c.req.param("routeKey")!;

  deleteLayoutOverride(storeId, routeKey);

  return c.json({ deleted: true, routeKey });
});

export default layouts;
