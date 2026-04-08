import type { Product } from "../types.ts";

// Phase 1: fixture data. Phase 2: replace with DB queries.
export const products: Product[] = [
  {
    id: "prod-1",
    handle: "classic-tee",
    title: "Classic Tee",
    price: "29.99",
    image: "https://picsum.photos/seed/tee1/600/600",
    description: "A timeless everyday essential. Relaxed fit, 100% organic cotton.",
    variants: [{ id: "v1-s", title: "S" }, { id: "v1-m", title: "M" }, { id: "v1-l", title: "L" }],
  },
  {
    id: "prod-2",
    handle: "slim-pants",
    title: "Slim Pants",
    price: "79.99",
    image: "https://picsum.photos/seed/pants2/600/600",
    description: "Tailored slim fit. Comfortable stretch fabric for all-day wear.",
    variants: [{ id: "v2-30", title: "30" }, { id: "v2-32", title: "32" }, { id: "v2-34", title: "34" }],
  },
  {
    id: "prod-3",
    handle: "canvas-sneakers",
    title: "Canvas Sneakers",
    price: "59.99",
    image: "https://picsum.photos/seed/shoes3/600/600",
    description: "Lightweight canvas upper with a vulcanised rubber sole.",
    variants: [{ id: "v3-40", title: "40" }, { id: "v3-41", title: "41" }, { id: "v3-42", title: "42" }],
  },
  {
    id: "prod-4",
    handle: "linen-shirt",
    title: "Linen Shirt",
    price: "49.99",
    image: "https://picsum.photos/seed/shirt4/600/600",
    description: "Breathable linen blend. Perfect for warm days.",
    variants: [{ id: "v4-s", title: "S" }, { id: "v4-m", title: "M" }, { id: "v4-l", title: "L" }],
  },
  {
    id: "prod-5",
    handle: "denim-jacket",
    title: "Denim Jacket",
    price: "119.99",
    image: "https://picsum.photos/seed/jacket5/600/600",
    description: "Classic denim jacket with a slightly oversized fit.",
    variants: [{ id: "v5-s", title: "S" }, { id: "v5-m", title: "M" }, { id: "v5-l", title: "L" }],
  },
  {
    id: "prod-6",
    handle: "leather-belt",
    title: "Leather Belt",
    price: "39.99",
    image: "https://picsum.photos/seed/belt6/600/600",
    description: "Full-grain leather belt with a brushed brass buckle.",
    variants: [{ id: "v6-85", title: "85cm" }, { id: "v6-90", title: "90cm" }, { id: "v6-95", title: "95cm" }],
  },
];
