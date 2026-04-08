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
    },
  ],
  [
    "store-2",
    {
      theme_id: "minimal",
      settings: { brand_color: "#6366f1", font_family: "dm-sans", border_radius: 12 },
      layout_overrides: {},
    },
  ],
]);

export async function getStoreTheme(storeId: string): Promise<StoreTheme | null> {
  return storeThemes.get(storeId) ?? null;
}

export async function putStoreTheme(storeId: string, data: StoreTheme): Promise<void> {
  storeThemes.set(storeId, data);
}

export async function getLayoutOverride(
  storeId: string,
  routeKey: string
): Promise<PageLayout | null> {
  const theme = storeThemes.get(storeId);
  return theme?.layout_overrides[routeKey] ?? null;
}

export async function putLayoutOverride(
  storeId: string,
  routeKey: string,
  layout: PageLayout
): Promise<void> {
  const theme = storeThemes.get(storeId);
  if (!theme) return;
  storeThemes.set(storeId, {
    ...theme,
    layout_overrides: { ...theme.layout_overrides, [routeKey]: layout },
  });
}

export async function deleteLayoutOverride(storeId: string, routeKey: string): Promise<void> {
  const theme = storeThemes.get(storeId);
  if (!theme) return;
  const { [routeKey]: _, ...rest } = theme.layout_overrides;
  storeThemes.set(storeId, { ...theme, layout_overrides: rest });
}
