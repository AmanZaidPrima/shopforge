import { STATIC_BASE } from "../config.ts";
import type { Store, ThemeSettings } from "../types.ts";

export function shellTop(
  _store: Store,
  theme: ThemeSettings,
  title: string,
  editorMode = false
): string {
  const editorHead = editorMode
    ? `
  <script>window.__editorMode = true;</script>
  <style>
    [data-section-id] { transition: outline 0.1s; }
    [data-section-id].sf--hover { outline: 2px solid #5c6ac4; outline-offset: -2px; cursor: pointer; }
    [data-section-id].sf--selected { outline: 2px solid #5c6ac4; outline-offset: -2px; background: rgba(92,106,196,0.04); }
  </style>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="${STATIC_BASE}/static/themes/${theme.id}/theme.css">
  <style>:root { --brand: ${theme.brand_color}; --radius: ${theme.border_radius}px; }</style>${editorHead}
  <script>
    document.addEventListener('alpine:init', () => {
      Alpine.store('cart', { count: 0 });
    });
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/htmx.org@2/dist/htmx.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"></script>
</head>
<body hx-boost="true">
`;
}

export function shellBottom(editorMode = false): string {
  const editorBridge = editorMode
    ? `
  <script>
    (function () {
      var hovered = null;
      function sec(el) { return el && el.closest ? el.closest('[data-section-id]') : null; }

      document.addEventListener('mouseover', function (e) {
        var s = sec(e.target);
        if (hovered !== s) {
          if (hovered) hovered.classList.remove('sf--hover');
          hovered = s;
          if (hovered) hovered.classList.add('sf--hover');
        }
      });

      document.addEventListener('click', function (e) {
        var s = sec(e.target);
        if (s) {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({
            type: 'sf:section:click',
            sectionId: s.dataset.sectionId,
            sectionType: s.dataset.sectionType,
          }, '*');
        }
      }, true);

      window.addEventListener('message', function (e) {
        if (!e.data || !e.data.type) return;
        if (e.data.type === 'sf:section:select') {
          document.querySelectorAll('.sf--selected').forEach(function (el) { el.classList.remove('sf--selected'); });
          var s = document.querySelector('[data-section-id="' + e.data.sectionId + '"]');
          if (s) { s.classList.add('sf--selected'); s.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        }
        if (e.data.type === 'sf:deselect') {
          document.querySelectorAll('.sf--selected').forEach(function (el) { el.classList.remove('sf--selected'); });
        }
        if (e.data.type === 'sf:section:patch') {
          var existing = document.querySelector('[data-section-id="' + e.data.sectionId + '"]');
          if (existing) {
            var tmp = document.createElement('div');
            tmp.innerHTML = e.data.html;
            var replacement = tmp.firstElementChild;
            if (replacement) {
              replacement.classList.add('sf--selected');
              existing.replaceWith(replacement);
            }
          }
        }
      });

      document.body.addEventListener('htmx:afterSwap', function () {
        document.querySelectorAll('.sf--selected').forEach(function (el) { el.classList.remove('sf--selected'); });
      });
    })();
  </script>`
    : "";

  return `${editorBridge}
</body>
</html>`;
}
