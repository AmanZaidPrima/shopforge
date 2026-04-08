import type { Store } from "../types.ts";

// Phase 1: hostname → store mapping.
// Phase 2: replace with KV lookup `stores:{hostname}`.
// Add `127.0.0.1 minimal.localhost` to /etc/hosts to demo the minimal store.

export const storesByHostname: Record<string, Store> = {
  localhost: { id: "store-1", name: "Dawn Demo Store", hostname: "localhost" },
  "minimal.localhost": { id: "store-2", name: "Minimal Demo Store", hostname: "minimal.localhost" },
};

export const defaultStore: Store = storesByHostname["localhost"]!;
