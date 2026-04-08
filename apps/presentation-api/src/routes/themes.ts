import { Hono } from "hono";
import { getThemeSchema, listThemes } from "../storage/index.ts";

const themes = new Hono();

// List all available platform themes
themes.get("/", (c) => {
  return c.json({ themes: listThemes() });
});

// Get full schema for a theme (settings_schema + default_layouts)
themes.get("/:themeId", async (c) => {
  const { themeId } = c.req.param();
  const schema = await getThemeSchema(themeId);

  if (!schema) return c.json({ error: "Theme not found" }, 404);

  return c.json({ theme_id: themeId, ...schema });
});

// List section types available in a theme
// Derived from default_layouts — all unique section types across all route layouts
themes.get("/:themeId/sections", async (c) => {
  const { themeId } = c.req.param();
  const schema = await getThemeSchema(themeId);

  if (!schema) return c.json({ error: "Theme not found" }, 404);

  const types = new Set<string>();
  for (const layout of Object.values(schema.default_layouts)) {
    for (const section of layout.sections) {
      types.add(section.type);
    }
  }

  return c.json({ theme_id: themeId, sections: [...types].sort() });
});

export default themes;
