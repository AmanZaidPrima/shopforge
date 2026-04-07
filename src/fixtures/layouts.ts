import type { PageLayout } from "../types.ts";

export const layouts: Record<string, PageLayout> = {
  home: {
    meta: { title: "Home — Dawn Demo Store" },
    sections: [
      { id: "hdr-1", type: "site-header", props: {} },
      {
        id: "hero-1",
        type: "hero-banner",
        props: {
          heading: "Summer Collection",
          subheading: "Minimal basics, elevated essentials.",
          ctaText: "Shop Now",
          ctaHref: "/collections/all",
        },
      },
      { id: "grid-1", type: "product-grid", props: { columns: 3, limit: 6 } },
      { id: "ftr-1", type: "site-footer", props: {} },
    ],
  },
  product: {
    meta: { title: "Product — Dawn Demo Store" },
    sections: [
      { id: "hdr-1", type: "site-header", props: {} },
      { id: "prod-1", type: "product-card", props: {} },
      { id: "ftr-1", type: "site-footer", props: {} },
    ],
  },
};
