import { Hono } from "hono";
import type { ThemeSettingsValues } from "../types.ts";
import { getStoreTheme, putStoreTheme, getThemeSchema } from "../storage/index.ts";

const store = new Hono();

// GET /stores/:storeId/theme
store.get("/", async (c) => {
  const storeId = c.req.param("storeId")!;
  const storeTheme = await getStoreTheme(storeId);

  if (!storeTheme) return c.json({ error: "Store not found" }, 404);

  return c.json(storeTheme);
});

// PUT /stores/:storeId/theme/settings
store.put("/settings", async (c) => {
  const storeId = c.req.param("storeId")!;
  const storeTheme = await getStoreTheme(storeId);

  if (!storeTheme) return c.json({ error: "Store not found" }, 404);

  const body = await c.req.json<Partial<ThemeSettingsValues>>();
  const updated = { ...storeTheme.settings, ...body };

  await putStoreTheme(storeId, { ...storeTheme, settings: updated });

  return c.json({ settings: updated });
});

// POST /stores/:storeId/theme/activate
store.post("/activate", async (c) => {
  const storeId = c.req.param("storeId")!;
  const { theme_id } = await c.req.json<{ theme_id: string }>();

  const schema = await getThemeSchema(theme_id);
  if (!schema) return c.json({ error: "Theme not found" }, 404);

  const defaults = schema.settings_schema;
  const settings: ThemeSettingsValues = {
    brand_color: String(defaults["brand_color"]?.default ?? "#000000"),
    font_family: String(defaults["font_family"]?.default ?? "inter"),
    border_radius: Number(defaults["border_radius"]?.default ?? 8),
  };

  await putStoreTheme(storeId, {
    theme_id,
    settings,
    layout_overrides: {}, // clear overrides on theme switch
  });

  return c.json({ theme_id, settings });
});

export default store;
