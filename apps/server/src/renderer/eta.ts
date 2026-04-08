import { Eta } from "eta";

export const eta = new Eta();

const fnCache = new Map<string, Function>();

// In production: templates come from KV (`themes:{themeId}:sections:{type}`)
// Here we fetch from the local static server, which mirrors that interface.
const STATIC_BASE = process.env.STATIC_BASE_URL ?? "http://localhost:3001";

export async function getSectionFn(themeId: string, type: string): Promise<Function> {
  const key = `${themeId}:${type}`;
  if (fnCache.has(key)) return fnCache.get(key)!;

  const url = `${STATIC_BASE}/static/themes/${themeId}/sections/${type}.eta`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Section template not found: ${url} (${res.status})`);
  }

  const templateStr = await res.text();
  // .bind(eta) required — compiled fns reference `this` internally for escape/config
  const fn = eta.compile(templateStr).bind(eta);
  fnCache.set(key, fn);
  return fn;
}
