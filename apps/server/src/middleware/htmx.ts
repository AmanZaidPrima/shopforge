import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types.ts";

export const htmxMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("isHtmx", c.req.header("HX-Request") === "true");
  await next();
};
