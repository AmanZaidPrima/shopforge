import type { Collection } from "../types.ts";
import { products } from "./products.ts";

// Phase 1: fixture collections. Phase 2: replace with DB queries.
export const collections: Collection[] = [
  {
    handle: "all",
    title: "All Products",
    description: "Browse our full range of timeless essentials.",
    productIds: products.map((p) => p.id),
  },
  {
    handle: "tops",
    title: "Tops",
    description: "Clean, considered basics for every occasion.",
    productIds: ["prod-1", "prod-4"],
  },
  {
    handle: "bottoms",
    title: "Bottoms",
    description: "Tailored fits built to last.",
    productIds: ["prod-2"],
  },
  {
    handle: "footwear",
    title: "Footwear",
    description: "Everyday shoes, done simply.",
    productIds: ["prod-3"],
  },
  {
    handle: "accessories",
    title: "Accessories",
    description: "The finishing details.",
    productIds: ["prod-6"],
  },
  {
    handle: "outerwear",
    title: "Outerwear",
    description: "Layering essentials.",
    productIds: ["prod-5"],
  },
];
