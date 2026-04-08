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

  const res = await fetch(`${API_BASE}/stores/resolve/${hostname}`).catch(() => null);
  const body = res?.ok ? await res.json() as {
    store: { id: string; name: string; hostname: string };
    storeTheme: { theme_id: string; settings: Omit<ThemeSettings, "id"> } | null;
  } : null;

  if (!body) {
    return c.json({ error: "Store not found" }, 404);
  }

  const themeSettings: ThemeSettings = body.storeTheme
    ? { id: body.storeTheme.theme_id, ...body.storeTheme.settings }
    : FALLBACK_THEME;

  c.set("store", body.store);
  c.set("themeSettings", themeSettings);
  await next();
};
