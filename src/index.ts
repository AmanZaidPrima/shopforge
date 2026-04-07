import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { STORE, THEME } from "./fixtures/store.ts";
import { layouts } from "./fixtures/layouts.ts";
import { renderSections, renderShell } from "./renderer.ts";
import type { RenderContext } from "./types.ts";

type Env = {
  Variables: { isHtmx: boolean };
};

const app = new Hono<Env>();

// HTMX detection middleware
app.use("*", async (c, next) => {
  c.set("isHtmx", c.req.header("HX-Request") === "true");
  await next();
});

// Static file serving (theme CSS, etc.)
app.use("/static/*", serveStatic({ root: "./" }));

// Core page renderer
async function renderPage(
  c: Parameters<Parameters<typeof app.get>[1]>[0],
  layoutKey: string,
  routeParams: Record<string, string> = {}
) {
  const layout = layouts[layoutKey];
  if (!layout) return c.text("Page not found", 404);

  const ctx: RenderContext = { store: STORE, theme: THEME, routeParams };

  try {
    const sectionsHtml = await renderSections(layout, ctx);

    if (c.get("isHtmx")) {
      // HTMX navigation — browser already has <head>, send body content only
      return c.html(sectionsHtml);
    }

    return c.html(renderShell(STORE, THEME, sectionsHtml, layout.meta.title));
  } catch (err) {
    console.error("Render error:", err);
    return c.text("Render error", 500);
  }
}

// --- Storefront routes ---
app.get("/", (c) => renderPage(c, "home"));
app.get("/products/:handle", (c) => renderPage(c, "product", { handle: c.req.param("handle") }));

// --- Cart action ---
app.post("/cart/add", async (c) => {
  // Phase 0: fixture response — cart state is managed client-side by Alpine
  return c.json({ success: true, count: 1 });
});

// --- Catch-all ---
app.get("*", (c) => renderPage(c, "home"));

export default {
  port: 3000,
  fetch: app.fetch,
};
