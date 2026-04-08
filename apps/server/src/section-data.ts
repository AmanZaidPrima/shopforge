import { products } from "./fixtures/products.ts";
import type { RenderContext } from "./types.ts";

type Resolver = (props: Record<string, unknown>, ctx: RenderContext) => Promise<unknown>;

const resolvers: Record<string, Resolver> = {
  "site-header": async () => ({}),

  "site-footer": async () => ({}),

  "hero-banner": async () => ({}),

  "product-grid": async (props) => ({
    products: products.slice(0, Number(props.limit) || 6),
  }),

  "product-card": async (_, { routeParams }) => ({
    product: products.find((p) => p.handle === routeParams.handle) ?? products[0],
  }),
};

export async function resolveSectionData(
  type: string,
  props: Record<string, unknown>,
  ctx: RenderContext
): Promise<unknown> {
  return resolvers[type]?.(props, ctx) ?? {};
}
