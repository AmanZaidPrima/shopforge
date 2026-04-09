import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, RenderContext } from "./types.ts";
import { htmxMiddleware } from "./middleware/htmx.ts";
import { tenantMiddleware } from "./middleware/tenant.ts";
import { renderPage } from "./renderer/page.ts";
import { eta, getSectionFn } from "./renderer/eta.ts";
import { wrapSection } from "./renderer/sections.ts";
import { resolveSectionData } from "./lib/section-data.ts";

const app = new Hono<AppEnv>();

// Allow editor to call preview endpoint
app.use("/preview-section", cors({ origin: "http://localhost:3003" }));

// Middleware
app.use("*", tenantMiddleware);
app.use("*", htmxMiddleware);

// Section Rendering API — used by editor for live preview while typing.
// POST /preview-section  { sectionId, sectionType, props }
// → renders just that section with caller-supplied props (not saved to layout)
// → returns { sectionId, html } so the editor can patch the iframe DOM via postMessage
app.post("/preview-section", async (c) => {
  const store = c.get("store");
  const theme = c.get("themeSettings");
  const { sectionId, sectionType, props } = await c.req.json<{
    sectionId: string;
    sectionType: string;
    props: Record<string, unknown>;
  }>();

  const ctx: RenderContext = {
    store,
    theme,
    routeParams: {},
    editorMode: true,
  };

  const [fn, data] = await Promise.all([
    getSectionFn(theme.id, sectionType),
    resolveSectionData(sectionType, props, ctx),
  ]);

  const html = fn({ props, data, store, theme, editorMode: true }, eta);
  const wrapped = wrapSection(html, sectionId, sectionType, true);

  return c.json({ sectionId, html: wrapped });
});

// Internal docs
app.get("/docs/:file", async (c) => {
  const file = Bun.file(`${import.meta.dir}/../public/${c.req.param("file")}`);
  if (!(await file.exists())) return c.notFound();
  return new Response(file, { headers: { "Content-Type": "text/html; charset=utf-8" } });
});

// Storefront routes
app.get("/favicon.ico", (c) => c.body(null, 204));
app.get("/", (c) => renderPage(c, "home"));
app.get("/products/:handle", (c) => renderPage(c, "product", { handle: c.req.param("handle") }));
app.get("/collections/:handle", (c) => renderPage(c, "collection", { handle: c.req.param("handle") }));
app.get("/cart", (c) => renderPage(c, "cart"));
app.get("/pages/:handle", (c) => renderPage(c, "page", { handle: c.req.param("handle") }));

// Cart action
app.post("/cart/add", async (c) => {
  return c.json({ success: true, count: 1 });
});

// Catch-all
app.get("*", (c) => renderPage(c, "home"));

export default {
  port: 3000,
  fetch: app.fetch,
};
