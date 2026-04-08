import { Eta } from "eta";
import { fetchTemplateString } from "../clients/presentation-api.ts";

export const eta = new Eta();

const fnCache = new Map<string, Function>();

export async function getSectionFn(themeId: string, type: string): Promise<Function> {
  const key = `${themeId}:${type}`;
  if (fnCache.has(key)) return fnCache.get(key)!;

  const templateStr = await fetchTemplateString(themeId, type);
  // .bind(eta) required — compiled fns reference `this` internally for escape/config
  const fn = eta.compile(templateStr).bind(eta);
  fnCache.set(key, fn);
  return fn;
}
