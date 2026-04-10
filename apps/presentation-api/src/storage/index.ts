import type { PageLayout, Store, StoreTheme, ThemeSchema } from "../types.ts";

// Phase 1: in-memory storage.
// Phase 2: swap implementations to read/write Cloudflare KV.
// Interface mirrors KV key structure:
//   stores:{hostname}               → Store record
//   stores:{store_id}:active_theme  → StoreTheme
//   themes:{theme_id}               → ThemeSchema

// -- Theme schema (read from disk; Phase 2: read from KV) --

// Path to theme static files. Defaults to sibling server app in monorepo.
const THEMES_PATH =
  process.env.THEMES_PATH ?? `${import.meta.dir}/../../static/themes`;

const AVAILABLE_THEMES = ["dawn", "minimal"] as const;

const schemaCache = new Map<string, ThemeSchema>();

export async function getThemeSchema(themeId: string): Promise<ThemeSchema | null> {
  if (schemaCache.has(themeId)) return schemaCache.get(themeId)!;

  const file = Bun.file(`${THEMES_PATH}/${themeId}/schema.json`);
  if (!(await file.exists())) return null;

  const schema = (await file.json()) as ThemeSchema;
  schemaCache.set(themeId, schema);
  return schema;
}

export function listThemes(): string[] {
  return [...AVAILABLE_THEMES];
}

// -- Store records (in-memory; Phase 2: KV `stores:{hostname}`) --

const storesByHostname = new Map<string, Store>([
  ["localhost",         { id: "store-1", name: "Dawn Demo Store",    hostname: "localhost" }],
  ["minimal.localhost", { id: "store-2", name: "Minimal Demo Store", hostname: "minimal.localhost" }],
]);

export function getStoreByHostname(hostname: string): Store | null {
  return storesByHostname.get(hostname) ?? null;
}

// -- Store theme (in-memory; Phase 2: KV `stores:{store_id}:active_theme`) --

const storeThemes = new Map<string, StoreTheme>([
  [
    "store-1",
    {
      theme_id: "dawn",
      settings: { brand_color: "#0f172a", font_family: "inter", border_radius: 8 },
      layout_overrides: {},
      draft_layout_overrides: {},
    },
  ],
  [
    "store-2",
    {
      theme_id: "minimal",
      settings: { brand_color: "#6366f1", font_family: "dm-sans", border_radius: 12 },
      layout_overrides: {},
      draft_layout_overrides: {},
    },
  ],
]);

export function getStoreTheme(storeId: string): StoreTheme | null {
  return storeThemes.get(storeId) ?? null;
}

export function putStoreTheme(storeId: string, data: StoreTheme): void {
  storeThemes.set(storeId, data);
}

// -- Published layouts (what shoppers see) --

export function getLayoutOverride(storeId: string, routeKey: string): PageLayout | null {
  return storeThemes.get(storeId)?.layout_overrides[routeKey] ?? null;
}

export function deleteLayoutOverride(storeId: string, routeKey: string): void {
  const theme = storeThemes.get(storeId);
  if (!theme) return;
  const { [routeKey]: _, ...rest } = theme.layout_overrides;
  storeThemes.set(storeId, { ...theme, layout_overrides: rest });
}

// -- Draft layouts (editor only, not visible to shoppers) --

export function getDraftLayoutOverride(storeId: string, routeKey: string): PageLayout | null {
  return storeThemes.get(storeId)?.draft_layout_overrides[routeKey] ?? null;
}

export function putDraftLayoutOverride(storeId: string, routeKey: string, layout: PageLayout): void {
  const theme = storeThemes.get(storeId);
  if (!theme) return;
  storeThemes.set(storeId, { ...theme, draft_layout_overrides: { ...theme.draft_layout_overrides, [routeKey]: layout } });
}

// Promotes draft → live. Returns false if no draft exists for this route.
export function publishDraftLayout(storeId: string, routeKey: string): boolean {
  const theme = storeThemes.get(storeId);
  if (!theme) return false;
  const draft = theme.draft_layout_overrides[routeKey];
  if (!draft) return false;
  storeThemes.set(storeId, { ...theme, layout_overrides: { ...theme.layout_overrides, [routeKey]: draft } });
  return true;
}

// -- Template store (in-memory; Phase 2: KV `themes:{theme_id}:sections:{type}`) --
//
// Simulates a DB table:
//   id | name (themeId:type) | content (template string) | updated_at
//
// Seeded lazily from disk on first read so existing .eta files are the
// initial "DB rows". In Phase 2, replace seed logic with a KV/DB read.

const templateStore = new Map<string, { content: string; updatedAt: Date }>();

export async function getTemplate(themeId: string, type: string): Promise<string | null> {
  const key = `${themeId}:${type}`;

  const file = Bun.file(`${THEMES_PATH}/${themeId}/sections/${type}.eta`);
  if (!(await file.exists())) return null;

  const fileMtime = new Date(file.lastModified);
  const cached = templateStore.get(key);

  // Serve from cache unless the file on disk is newer (covers both dev edits and PUT overrides)
  if (cached && cached.updatedAt >= fileMtime) return cached.content;

  const content = await file.text();
  templateStore.set(key, { content, updatedAt: fileMtime });
  return content;
}

export function putTemplate(themeId: string, type: string, content: string): void {
  // Equivalent to: UPDATE templates SET content = ?, updated_at = NOW() WHERE name = ?
  templateStore.set(`${themeId}:${type}`, { content, updatedAt: new Date() });
}

export function getTemplateUpdatedAt(themeId: string, type: string): Date | null {
  return templateStore.get(`${themeId}:${type}`)?.updatedAt ?? null;
}

export async function getSectionSchema(themeId: string, type: string): Promise<unknown | null> {
  const themeSchema = await getThemeSchema(themeId);
  return themeSchema?.section_schemas?.[type] ?? null;
}
