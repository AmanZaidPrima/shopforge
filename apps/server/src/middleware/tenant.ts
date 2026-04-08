import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types.ts";
import { storesByHostname, defaultStore } from "../fixtures/stores.ts";

export const tenantMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const hostname = new URL(c.req.url).hostname;
  const record = storesByHostname[hostname] ?? defaultStore;
  c.set("store", record.store);
  c.set("themeSettings", record.themeSettings);
  await next();
};
