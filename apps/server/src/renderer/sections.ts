import { eta, getSectionFn } from "./eta.ts";
import { resolveSectionData } from "../lib/section-data.ts";
import type { PageLayout, RenderContext } from "../types.ts";

// Renders all sections in a layout to a single HTML string.
// Used for HTMX partial responses (no shell needed).
export async function renderSections(layout: PageLayout, ctx: RenderContext): Promise<string> {
  const sections = layout.sections.filter((s) => !s.disabled);

  const dataResults = await Promise.all(
    sections.map((s) => resolveSectionData(s.type, s.props, ctx))
  );

  const htmlParts = await Promise.all(
    sections.map(async (s, i) => {
      const fn = await getSectionFn(ctx.theme.id, s.type);
      return fn({ props: s.props, data: dataResults[i], store: ctx.store, theme: ctx.theme }, eta);
    })
  );

  return htmlParts.join("\n");
}
