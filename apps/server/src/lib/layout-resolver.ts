import { fetchLayout } from "../clients/presentation-api.ts";
import type { PageLayout } from "../types.ts";

export async function resolveLayout(
  storeId: string,
  routeKey: string,
  storeName: string,
  draft = false
): Promise<PageLayout | null> {
  const layout = await fetchLayout(storeId, routeKey, draft);
  if (!layout) return null;

  return {
    ...layout,
    meta: {
      ...layout.meta,
      title: layout.meta.title.replace("{{store.name}}", storeName),
    },
  };
}
