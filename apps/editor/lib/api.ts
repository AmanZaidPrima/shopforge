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
  description: string;
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

export async function fetchSectionSchema(
  themeId: string,
  sectionType: string
): Promise<SectionSchema | null> {
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

// Calls server's POST /preview-section — renders the section with the given props
// without saving to layout. Returns the wrapped HTML string for iframe injection.
export async function previewSection(
  sectionId: string,
  sectionType: string,
  props: Record<string, unknown>
): Promise<string | null> {
  const res = await fetch(`${STOREFRONT_BASE}/preview-section`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sectionId, sectionType, props }),
  });
  if (!res.ok) return null;
  const { html } = await res.json() as { sectionId: string; html: string };
  return html;
}

export async function saveLayout(storeId: string, routeKey: string, layout: PageLayout): Promise<void> {
  await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
}
