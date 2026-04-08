import type { PageLayout } from "../types.ts";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001";

// Fetches the resolved layout for a route from the API.
// The API handles the override chain: merchant override ?? theme default.
export async function resolveLayout(
  storeId: string,
  routeKey: string,
  storeName: string
): Promise<PageLayout | null> {
  const res = await fetch(`${API_BASE}/stores/${storeId}/layouts/${routeKey}`);
  if (!res.ok) return null;

  const { layout } = (await res.json()) as { layout: PageLayout };

  return {
    ...layout,
    meta: {
      ...layout.meta,
      title: layout.meta.title.replace("{{store.name}}", storeName),
    },
  };
}
