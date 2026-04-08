import type { RenderContext } from "../types.ts";

const STORE_API = process.env.STORE_API_URL ?? "http://localhost:3002";

type Resolver = (props: Record<string, unknown>, ctx: RenderContext) => Promise<unknown>;

const resolvers: Record<string, Resolver> = {
  "site-header": async () => ({}),

  "site-footer": async () => ({}),

  "hero-banner": async () => ({}),

  "cart-page": async () => ({}),

  "product-grid": async (props, { store }) => {
    const limit = Number(props.limit) || 6;
    const res = await fetch(`${STORE_API}/stores/${store.id}/products?limit=${limit}`);
    return { products: res.ok ? await res.json() : [] };
  },

  "product-card": async (_, { store, routeParams }) => {
    const res = await fetch(`${STORE_API}/stores/${store.id}/products/${routeParams.handle}`);
    return { product: res.ok ? await res.json() : null };
  },

  "collection-filter": async (props, { store, routeParams }) => {
    const handle = routeParams.handle ?? "all";
    const limit = Number(props.limit) || 12;
    const [colRes, prodRes] = await Promise.all([
      fetch(`${STORE_API}/stores/${store.id}/collections/${handle}`),
      fetch(`${STORE_API}/stores/${store.id}/collections/${handle}/products?limit=${limit}`),
    ]);
    return {
      collection: colRes.ok ? await colRes.json() : null,
      products: prodRes.ok ? await prodRes.json() : [],
    };
  },

  "content-page": async (_, { store, routeParams }) => {
    const res = await fetch(`${STORE_API}/stores/${store.id}/pages/${routeParams.handle ?? "about"}`);
    return res.ok ? await res.json() : { title: "Page Not Found", content: "This page does not exist." };
  },
};

export async function resolveSectionData(
  type: string,
  props: Record<string, unknown>,
  ctx: RenderContext
): Promise<unknown> {
  return resolvers[type]?.(props, ctx) ?? {};
}
