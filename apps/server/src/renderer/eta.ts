import { Eta } from "eta";
import { fetchTemplateString } from "../clients/presentation-api.ts";

export const eta = new Eta();

// Cache stores both the compiled fn and the source string it was compiled from.
// On each request: fetch the template string, recompile only if it changed.
// Behaves identically in dev and prod — cache is always valid, never stale.
const fnCache = new Map<string, { fn: Function; src: string }>();

export async function getSectionFn(themeId: string, type: string): Promise<Function> {
  const key = `${themeId}:${type}`;
  const templateStr = await fetchTemplateString(themeId, type);

  const cached = fnCache.get(key);
  if (cached && cached.src === templateStr) return cached.fn;

  // .bind(eta) required — compiled fns reference `this` internally for escape/config
  const fn = eta.compile(templateStr).bind(eta);
  fnCache.set(key, { fn, src: templateStr });
  return fn;
}
