import { stream } from "hono/streaming";
import type { Context } from "hono";
import type { AppEnv, RenderContext } from "../types.ts";
import { eta, getSectionFn } from "./eta.ts";
import { renderSections, wrapSection } from "./sections.ts";
import { shellTop, shellBottom } from "./shell.ts";
import { resolveSectionData } from "../lib/section-data.ts";
import { resolveLayout } from "../lib/layout-resolver.ts";

export async function renderPage(
  c: Context<AppEnv>,
  routeKey: string,
  routeParams: Record<string, string> = {}
): Promise<Response> {
  const store = c.get("store");
  const themeSettings = c.get("themeSettings");
  const editorMode = c.get("editorMode");

  const layout = await resolveLayout(store.id, routeKey, store.name);
  if (!layout) return c.text("Page not found", 404);

  const ctx: RenderContext = { store, theme: themeSettings, routeParams, editorMode };

  if (c.get("isHtmx")) {
    try {
      const html = await renderSections(layout, ctx);
      return c.html(html);
    } catch (err) {
      console.error("HTMX render error:", err);
      return c.text("Render error", 500);
    }
  }

  const title = layout.meta.title;
  const sections = layout.sections.filter((s) => !s.disabled);

  c.header("Content-Type", "text/html; charset=utf-8");

  return stream(c, async (s) => {
    try {
      await s.write(shellTop(store, themeSettings, title, editorMode));

      const dataResults = await Promise.all(
        sections.map((section) => resolveSectionData(section.type, section.props, ctx))
      );

      for (const [i, section] of sections.entries()) {
        const fn = await getSectionFn(themeSettings.id, section.type);
        const html = fn(
          { props: section.props, data: dataResults[i], store, theme: themeSettings, editorMode },
          eta
        );
        const wrapped = wrapSection(html, section.id, section.type, editorMode);
        await s.write(wrapped + "\n");
      }

      await s.write(shellBottom(editorMode));
    } catch (err) {
      console.error("Stream render error:", err);
      await s.write("<p style='color:red;padding:2rem'>Render error — check server logs</p>");
      await s.write(shellBottom());
    }
  });
}
