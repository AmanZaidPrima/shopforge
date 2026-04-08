import type { Product } from "../fixtures/products.ts";

// Phase 1: stub API client backed by fixture data.
// Phase 2: replace implementations with real HTTP calls to the backend API.
// This is the only place in the codebase that should know the backend's API shape.

export type ApiClient = {
  getProducts: (options?: { collectionHandle?: string; limit?: number }) => Promise<Product[]>;
  getProduct: (handle: string) => Promise<Product | null>;
};

export function createApiClient(_storeId: string, _apiKey?: string): ApiClient {
  return {
    async getProducts({ limit = 12 } = {}) {
      const { products } = await import("../fixtures/products.ts");
      return products.slice(0, limit);
    },
    async getProduct(handle) {
      const { products } = await import("../fixtures/products.ts");
      return products.find((p) => p.handle === handle) ?? null;
    },
  };
}
