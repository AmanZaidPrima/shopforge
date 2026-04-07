import { Eta } from "eta";
import type { PageLayout, Store, ThemeSettings, RenderContext } from "./types.ts";
import { resolveSectionData } from "./section-data.ts";

const eta = new Eta();
const fnCache = new Map<string, Function>();

async function getSectionFn(themeId: string, type: string) {
  const key = `${themeId}:${type}`;
  if (fnCache.has(key)) return fnCache.get(key)!;

  const templatePath = `${import.meta.dir}/../static/themes/${themeId}/sections/${type}.eta`;
  const file = Bun.file(templatePath);

  if (!(await file.exists())) {
    throw new Error(`Section template not found: ${templatePath}`);
  }

  const templateStr = await file.text();
  // Bind to eta instance — compiled fns use `this` internally
  const fn = eta.compile(templateStr).bind(eta);
  fnCache.set(key, fn);
  return fn;
}

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

export function renderShell(_store: Store, theme: ThemeSettings, body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/static/themes/${theme.id}/theme.css">
  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.store('cart', { count: 0 });
    });
  </script>
  <script src="https://unpkg.com/htmx.org@2/dist/htmx.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
</head>
<body hx-boost="true">
${body}
</body>
</html>`;
}
