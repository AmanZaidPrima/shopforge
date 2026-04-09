import { Hono } from "hono";
import { getTemplate, getTemplateUpdatedAt, getThemeSchema, getSectionSchema, listThemes, putTemplate } from "../storage/index.ts";

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

// GET /:themeId/sections/:type/schema
// Returns the section schema JSON (name, description, settings[])
themes.get("/:themeId/sections/:type/schema", async (c) => {
  const { themeId, type } = c.req.param();
  const schema = await getSectionSchema(themeId, type);
  if (!schema) return c.json({ error: "Schema not found" }, 404);
  return c.json(schema);
});

// GET /:themeId/sections/:type
// Returns the raw template string (text/plain) — equivalent to:
//   SELECT content FROM templates WHERE name = '{themeId}:{type}'
// This is how the render server fetches templates; in Phase 2 the store
// reads from KV/DB instead of the in-memory Map seeded from disk.
themes.get("/:themeId/sections/:type", async (c) => {
  const { themeId, type } = c.req.param();
  const content = await getTemplate(themeId, type);

  if (!content) return c.json({ error: "Template not found" }, 404);

  const updatedAt = getTemplateUpdatedAt(themeId, type);
  return c.text(content, 200, {
    "Last-Modified": updatedAt?.toUTCString() ?? new Date().toUTCString(),
  });
});

// PUT /:themeId/sections/:type
// Replaces the template string — equivalent to:
//   UPDATE templates SET content = ?, updated_at = NOW() WHERE name = '{themeId}:{type}'
// The editor app calls this when a merchant saves a section edit.
// Note: the render server's compile cache (Map<key, fn>) will be stale
// until it restarts. Phase 2 will use a cache-bust mechanism (e.g. version
// token in GET response that the server uses as fnCache key).
themes.put("/:themeId/sections/:type", async (c) => {
  const { themeId, type } = c.req.param();
  const content = await c.req.text();

  if (!content.trim()) return c.json({ error: "Template content is required" }, 400);

  putTemplate(themeId, type, content);
  return c.json({ ok: true, themeId, type, updatedAt: new Date().toISOString() });
});

export default themes;
