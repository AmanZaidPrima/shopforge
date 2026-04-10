import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, RenderContext } from "./types.ts";
import { htmxMiddleware } from "./middleware/htmx.ts";
import { tenantMiddleware } from "./middleware/tenant.ts";
import { renderPage } from "./renderer/page.ts";
import { eta, getSectionFn } from "./renderer/eta.ts";
import { wrapSection } from "./renderer/sections.ts";
import { resolveSectionData } from "./lib/section-data.ts";
import { resolveLayout } from "./lib/layout-resolver.ts";
import type { Section } from "./types.ts";

const app = new Hono<AppEnv>();

// Allow editor to call section rendering endpoint
app.use("/render-sections", cors({ origin: "http://localhost:3003" }));

// Middleware
app.use("*", tenantMiddleware);
app.use("*", htmxMiddleware);

// Section Rendering API — used by editor after auto-saving a prop change.
// GET /render-sections?sectionId=hero-1&routeKey=home
// → reads the saved layout, renders that section, returns { [sectionId]: html }
app.get("/render-sections", async (c) => {
  const store = c.get("store");
  const theme = c.get("themeSettings");
  const sectionId = c.req.query("sectionId");
  const routeKey = c.req.query("routeKey") ?? "home";

  if (!sectionId) return c.json({ error: "sectionId required" }, 400);

  const layout = await resolveLayout(store.id, routeKey, store.name);
  if (!layout) return c.json({ error: "Layout not found" }, 404);

  const section = layout.sections.find((s: Section) => s.id === sectionId);
  if (!section) return c.json({ error: "Section not found" }, 404);

  const ctx: RenderContext = { store, theme, routeParams: {}, editorMode: true };
  const [fn, data] = await Promise.all([
    getSectionFn(theme.id, section.type),
    resolveSectionData(section.type, section.props, ctx),
  ]);

  const html = fn({ props: section.props, data, store, theme, editorMode: true }, eta);
  return c.json({ [sectionId]: wrapSection(html, sectionId, section.type, true) });
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
