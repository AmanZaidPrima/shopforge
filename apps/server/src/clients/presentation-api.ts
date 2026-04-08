import { PRESENTATION_API } from "../config.ts";
import type { PageLayout, Store, ThemeSettings } from "../types.ts";

type ResolveStoreResult = {
  store: Store;
  storeTheme: { theme_id: string; settings: Omit<ThemeSettings, "id"> } | null;
};

// Throws on network error, returns null on 404.
export async function resolveStore(hostname: string): Promise<ResolveStoreResult | null> {
  const res = await fetch(`${PRESENTATION_API}/stores/resolve/${hostname}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Store resolve failed: ${res.status}`);
  return res.json() as Promise<ResolveStoreResult>;
}

export async function fetchLayout(storeId: string, routeKey: string): Promise<PageLayout | null> {
  const res = await fetch(`${PRESENTATION_API}/stores/${storeId}/layouts/${routeKey}`);
  if (!res.ok) return null;
  const { layout } = (await res.json()) as { layout: PageLayout };
  return layout;
}

// Fetches a template string from the presentation-api template store.
// presentation-api is the source of truth for templates (seeded from disk,
// writable via PUT /themes/:themeId/sections/:type).
// Phase 2: the store reads from KV/DB — no code change needed here.
export async function fetchTemplateString(themeId: string, type: string): Promise<string> {
  const res = await fetch(`${PRESENTATION_API}/themes/${themeId}/sections/${type}`);
  if (!res.ok) throw new Error(`Section template not found: ${themeId}:${type} (${res.status})`);
  return res.text();
}
