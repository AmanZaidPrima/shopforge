import type { MiddlewareHandler } from "hono";
import type { AppEnv, ThemeSettings } from "../types.ts";
import { storesByHostname, defaultStore } from "../fixtures/stores.ts";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_THEME: ThemeSettings = {
  id: "dawn",
  brand_color: "#0f172a",
  font_family: "inter",
  border_radius: 8,
};

export const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const hostname = new URL(c.req.url).hostname;
  const store = storesByHostname[hostname] ?? defaultStore;

  // Fetch live theme settings from API (settings may have been updated via builder)
  let themeSettings: ThemeSettings = FALLBACK_THEME;
  try {
    const res = await fetch(`${API_BASE}/stores/${store.id}/theme`);
    if (res.ok) {
      const { theme_id, settings } = await res.json() as {
        theme_id: string;
        settings: Omit<ThemeSettings, "id">;
      };
      themeSettings = { id: theme_id, ...settings };
    }
  } catch {
    // API unreachable — use fallback so the server stays up
  }

  c.set("store", store);
  c.set("themeSettings", themeSettings);
  await next();
};
