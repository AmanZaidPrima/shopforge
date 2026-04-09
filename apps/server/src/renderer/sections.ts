import { eta, getSectionFn } from "./eta.ts";
import { resolveSectionData } from "../lib/section-data.ts";
import type { PageLayout, RenderContext } from "../types.ts";

export function wrapSection(html: string, id: string, type: string, editorMode: boolean): string {
  if (!editorMode) return html;
  return `<div data-section-id="${id}" data-section-type="${type}">${html}</div>`;
}

export async function renderSections(
  layout: PageLayout,
  ctx: RenderContext
): Promise<string> {
  const sections = layout.sections.filter((s) => !s.disabled);

  const dataResults = await Promise.all(
    sections.map((s) => resolveSectionData(s.type, s.props, ctx))
  );

  const htmlParts = await Promise.all(
    sections.map(async (s, i) => {
      const fn = await getSectionFn(ctx.theme.id, s.type);
      const html = fn({ props: s.props, data: dataResults[i], store: ctx.store, theme: ctx.theme, editorMode: ctx.editorMode ?? false }, eta);
      return wrapSection(html, s.id, s.type, ctx.editorMode ?? false);
    })
  );

  return htmlParts.join("\n");
}
