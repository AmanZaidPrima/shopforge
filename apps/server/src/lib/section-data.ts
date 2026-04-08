import { products } from "../fixtures/products.ts";
import type { RenderContext } from "../types.ts";

type Resolver = (props: Record<string, unknown>, ctx: RenderContext) => Promise<unknown>;

const resolvers: Record<string, Resolver> = {
  "site-header": async () => ({}),

  "site-footer": async () => ({}),

  "hero-banner": async () => ({}),

  "product-grid": async (props) => ({
    products: products.slice(0, Number(props.limit) || 6),
  }),

  // Product detail page section
  "product-card": async (_, { routeParams }) => ({
    product: products.find((p) => p.handle === routeParams.handle) ?? products[0],
  }),

  // Collection page with Alpine-powered client-side filter
  "collection-filter": async (props) => ({
    products: products.slice(0, Number(props.limit) || 12),
  }),

  // Cart page — state is entirely client-side (Alpine.store)
  "cart-page": async () => ({}),

  // Generic content page (about, contact, etc.)
  "content-page": async (_, ctx) => {
    const pages: Record<string, { title: string; content: string }> = {
      about: {
        title: "About Us",
        content:
          "We believe in the beauty of simplicity. Our carefully curated collection brings you timeless essentials that stand the test of time.",
      },
      contact: {
        title: "Contact",
        content: "Have a question? Reach us at hello@store.com. We respond within 24 hours.",
      },
    };
    const handle = ctx.routeParams.handle ?? "about";
    return pages[handle] ?? { title: "Page Not Found", content: "This page does not exist." };
  },
};

export async function resolveSectionData(
  type: string,
  props: Record<string, unknown>,
  ctx: RenderContext
): Promise<unknown> {
  return resolvers[type]?.(props, ctx) ?? {};
}
