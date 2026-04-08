import type { MiddlewareHandler } from "hono";
import { resolveStore } from "../clients/presentation-api.ts";
import { PRESENTATION_API } from "../config.ts";
import type { AppEnv, ThemeSettings } from "../types.ts";

const FALLBACK_THEME: ThemeSettings = {
  id: "dawn",
  brand_color: "#0f172a",
  font_family: "inter",
  border_radius: 8,
};

export const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const hostname = new URL(c.req.url).hostname;

  let result: Awaited<ReturnType<typeof resolveStore>>;
  try {
    result = await resolveStore(hostname);
  } catch {
    console.error(`[tenant] presentation-api unreachable at ${PRESENTATION_API}. Run apps/presentation-api.`);
    return c.json({ error: "Presentation API unavailable" }, 503);
  }

  if (!result) {
    return c.json({ error: `No store configured for hostname: ${hostname}` }, 404);
  }

  const { store, storeTheme } = result;
  const themeSettings: ThemeSettings = storeTheme
    ? { id: storeTheme.theme_id, ...storeTheme.settings }
    : FALLBACK_THEME;

  c.set("store", store);
  c.set("themeSettings", themeSettings);
  await next();
};
