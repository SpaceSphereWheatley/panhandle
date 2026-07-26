import { nb } from "./dictionaries/nb.js";
import { en } from "./dictionaries/en.js";

const DICTIONARIES = { nb, en };
const DEFAULT_LANG = "nb";

export function interpolate(str, params) {
  return str.replace(/\{(\w+)\}/g, (_, key) => params?.[key] ?? "");
}

// Dictionary entries are either a plain string, or { one, other } for the
// one true plural case this app has (item count) — count===1 picks "one".
// Only models a 1-vs-everything plural boundary; fine for nb/en, would need
// a real CLDR plural-rules table for a language with more categories.
export function translate(lang, key, params) {
  const dict = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANG];
  const entry = dict[key] ?? DICTIONARIES[DEFAULT_LANG][key];
  if (entry === undefined) return key;
  const value = typeof entry === "object" ? (params?.count === 1 ? entry.one : entry.other) : entry;
  return interpolate(value, params);
}
