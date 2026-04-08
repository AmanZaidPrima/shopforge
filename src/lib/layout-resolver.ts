import type { PageLayout, ThemeSchema } from "../types.ts";

const schemaCache = new Map<string, ThemeSchema>();

// In production: schema comes from KV (`themes:{themeId}`)
// Here we fetch from the local static server, which mirrors that interface.
const STATIC_BASE = process.env.STATIC_BASE_URL ?? "http://localhost:3000";

async function getThemeSchema(themeId: string): Promise<ThemeSchema | null> {
  if (schemaCache.has(themeId)) return schemaCache.get(themeId)!;

  const url = `${STATIC_BASE}/static/themes/${themeId}/schema.json`;
  const res = await fetch(url);

  if (!res.ok) return null;

  const schema = (await res.json()) as ThemeSchema;
  schemaCache.set(themeId, schema);
  return schema;
}

// Phase 1: reads default_layouts from theme schema (no merchant overrides yet).
// Phase 2: check storeTheme.layout_overrides[routeKey] first, fall back to theme default.
export async function resolveLayout(
  themeId: string,
  routeKey: string,
  storeName: string
): Promise<PageLayout | null> {
  const schema = await getThemeSchema(themeId);
  const layout = schema?.default_layouts[routeKey] ?? null;
  if (!layout) return null;

  return {
    ...layout,
    meta: {
      ...layout.meta,
      title: layout.meta.title.replace("{{store.name}}", storeName),
    },
  };
}
