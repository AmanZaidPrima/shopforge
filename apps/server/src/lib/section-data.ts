import {
  fetchCollection,
  fetchCollectionProducts,
  fetchPage,
  fetchProduct,
  fetchProducts,
} from "../clients/store-api.ts";
import type { RenderContext } from "../types.ts";

type Resolver = (props: Record<string, unknown>, ctx: RenderContext) => Promise<unknown>;

const resolvers: Record<string, Resolver> = {
  "site-header": async () => ({}),
  "site-footer": async () => ({}),
  "hero-banner": async () => ({}),
  "cart-page": async () => ({}),

  "product-grid": async (props, { store }) => {
    const limit = Number(props.limit) || 6;
    return { products: await fetchProducts(store.id, limit) };
  },

  "product-card": async (_, { store, routeParams }) => {
    return { product: await fetchProduct(store.id, routeParams.handle!) };
  },

  "collection-filter": async (props, { store, routeParams }) => {
    const handle = routeParams.handle ?? "all";
    const limit = Number(props.limit) || 12;
    const [collection, products] = await Promise.all([
      fetchCollection(store.id, handle),
      fetchCollectionProducts(store.id, handle, limit),
    ]);
    return { collection, products };
  },

  "content-page": async (_, { store, routeParams }) => {
    const page = await fetchPage(store.id, routeParams.handle ?? "about");
    return page ?? { title: "Page Not Found", content: "This page does not exist." };
  },
};

export async function resolveSectionData(
  type: string,
  props: Record<string, unknown>,
  ctx: RenderContext
): Promise<unknown> {
  return resolvers[type]?.(props, ctx) ?? {};
}
