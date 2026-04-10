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

export async function fetchLayout(storeId: string, routeKey: string): Promise<PageLayout | null> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}`);
  if (!res.ok) return null;
  const data = await res.json() as { layout: PageLayout };
  return data.layout;
}

export async function saveLayout(storeId: string, routeKey: string, layout: PageLayout): Promise<void> {
  await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
}

// Fetches fresh rendered HTML for a single section from the server,
// using the already-saved layout as source of truth.
export async function fetchRenderedSection(routeKey: string, sectionId: string): Promise<string | null> {
  const res = await fetch(`${STOREFRONT_BASE}/render-sections?sectionId=${encodeURIComponent(sectionId)}&routeKey=${encodeURIComponent(routeKey)}`);
  if (!res.ok) return null;
  const data = await res.json() as Record<string, string>;
  return data[sectionId] ?? null;
}
