import type { StoreRecord } from "../types.ts";

// Phase 1: two fixture stores resolved by hostname.
// Add `127.0.0.1 minimal.localhost` to /etc/hosts to demo the minimal store locally.
// Falls back to dawn store for any unrecognised hostname.

export const storesByHostname: Record<string, StoreRecord> = {
  localhost: {
    store: { id: "store-1", name: "Dawn Demo Store", hostname: "localhost" },
    themeSettings: { id: "dawn", brand_color: "#0f172a", font_family: "inter", border_radius: 8 },
  },
  "minimal.localhost": {
    store: { id: "store-2", name: "Minimal Demo Store", hostname: "minimal.localhost" },
    themeSettings: { id: "minimal", brand_color: "#6366f1", font_family: "dm-sans", border_radius: 12 },
  },
};

export const defaultStore: StoreRecord = storesByHostname["localhost"]!;
