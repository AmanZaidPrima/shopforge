import type { Store, ThemeSettings } from "../types.ts";

export function shellTop(store: Store, theme: ThemeSettings, title: string): string {
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
`;
}

export function shellBottom(): string {
  return `
</body>
</html>`;
}
