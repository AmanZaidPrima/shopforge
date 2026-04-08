import type { MiddlewareHandler } from "hono";
import type { AppEnv, ThemeSettings } from "../types.ts";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3001";

const FALLBACK_THEME: ThemeSettings = {
  id: "dawn",
  brand_color: "#0f172a",
  font_family: "inter",
  border_radius: 8,
};

export const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const hostname = new URL(c.req.url).hostname;

  let res: Response | null = null;
  try {
    res = await fetch(`${API_BASE}/stores/resolve/${hostname}`);
  } catch {
    // Presentation API unreachable — likely not running in dev
    console.error(`[tenant] presentation-api unreachable at ${API_BASE}. Run apps/presentation-api.`);
    return c.json({ error: "Presentation API unavailable" }, 503);
  }

  if (res.status === 404) {
    return c.json({ error: `No store configured for hostname: ${hostname}` }, 404);
  }

  if (!res.ok) {
    return c.json({ error: "Failed to resolve store" }, 502);
  }

  const { store, storeTheme } = await res.json() as {
    store: { id: string; name: string; hostname: string };
    storeTheme: { theme_id: string; settings: Omit<ThemeSettings, "id"> } | null;
  };

  const themeSettings: ThemeSettings = storeTheme
    ? { id: storeTheme.theme_id, ...storeTheme.settings }
    : FALLBACK_THEME;

  c.set("store", store);
  c.set("themeSettings", themeSettings);
  await next();
};
