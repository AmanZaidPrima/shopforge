const API_BASE = process.env.NEXT_PUBLIC_PRESENTATION_API_URL ?? "http://localhost:3001";
const STOREFRONT_BASE = process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";

export type SectionSettingType = "text" | "url" | "range" | "color";

export interface SectionSetting {
  type: SectionSettingType;
  id: string;
  label: string;
  default?: string | number;
  min?: number;
  max?: number;
  step?: number;
}

export interface SectionSchema {
  name: string;
  description?: string;
  settings: SectionSetting[];
}

export interface PageLayout {
  meta: { title: string };
  sections: Array<{
    id: string;
    type: string;
    disabled?: boolean;
    props: Record<string, unknown>;
  }>;
}

export async function fetchSectionSchema(themeId: string, sectionType: string): Promise<SectionSchema | null> {
  const res = await fetch(`${API_BASE}/themes/${themeId}/sections/${sectionType}/schema`);
  if (!res.ok) return null;
  return res.json() as Promise<SectionSchema>;
}

// Always fetch the draft so the editor shows in-progress work, not the live state.
export async function fetchLayout(storeId: string, routeKey: string): Promise<PageLayout | null> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}?draft=1`);
  if (!res.ok) return null;
  const data = await res.json() as { layout: PageLayout };
  return data.layout;
}

// Saves to draft only — does not affect the live storefront.
export async function saveLayout(storeId: string, routeKey: string, layout: PageLayout): Promise<void> {
  await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
}

// Promotes the current draft to live.
export async function publishLayout(storeId: string, routeKey: string): Promise<void> {
  await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}/publish`, {
    method: "POST",
  });
}

export async function fetchSectionTemplate(themeId: string, sectionType: string): Promise<string | null> {
  const res = await fetch(`${API_BASE}/themes/${themeId}/sections/${sectionType}`);
  if (!res.ok) return null;
  return res.text();
}

export async function saveSectionTemplate(themeId: string, sectionType: string, content: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/themes/${themeId}/sections/${sectionType}`, {
    method: "PUT",
    headers: { "Content-Type": "text/plain" },
    body: content,
  });
  return res.ok;
}

// Fetches fresh rendered HTML for a single section from the server,
// using the already-saved layout as source of truth.
export async function fetchRenderedSection(routeKey: string, sectionId: string): Promise<string | null> {
  const res = await fetch(`${STOREFRONT_BASE}/render-sections?sectionId=${encodeURIComponent(sectionId)}&routeKey=${encodeURIComponent(routeKey)}`);
  if (!res.ok) return null;
  const data = await res.json() as Record<string, string>;
  return data[sectionId] ?? null;
}
