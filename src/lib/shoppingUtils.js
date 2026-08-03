// Pure helpers ported from public/app.html's shopping-list script section.
export { CATEGORIES } from "../../shared/categories.js";
import { translateItemName } from "./i18n/itemNames.js";

// Upper-cases the first character of an item/catalogue name for display,
// leaving the rest as stored. Mirrors the server's capitalizeName.
export function cap(s) {
  const t = s == null ? "" : String(s);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Recognized quantity units, fused or spaced with a number ("2L", "500g",
// "2 kg", "3 stk"), split into two semantic groups since they behave
// differently (Norwegian: Antall vs Mengde). Order doesn't matter for
// correctness here since the trailing \b in each match forces the regex
// engine to backtrack onto a longer alternative (e.g. "lb" over "l") when a
// shorter one leaves it mid-word. English/Norwegian synonyms sit in the same
// list rather than being switched by device `lang`, same as
// extractGF/matchCatalogue below — the shared list can be typed into by any
// household member's device regardless of that device's own language, plus a
// set of imperial units since not every household is metric.
const ANTALL_ALT = "stk|pakke|pk|boks|pose|flaske|dusin|knippe|par|pack|pkg|can|bag|bottle|dozen|bunch|pair";
const MENGDE_ALT = "kg|mg|g|ml|l|dl|cl|lbs|lb|oz|tbsp|tsp|cup|gal|qt|pt";
const UNIT_ALT = `${MENGDE_ALT}|${ANTALL_ALT}`;
const MENGDE_SET = new Set(MENGDE_ALT.split("|"));

// A number paired with a unit may carry a decimal part — comma or dot, either
// accepted regardless of device language, same reasoning as the unit words
// above ("1,5 kg" and "1.5 kg" both parse). A bare number with no unit (the
// last two branches below) stays integer-only.
const QTY_ALT = "\\d+(?:[.,]\\d+)?";

// A Mengde match ("50 g", "1,5 kg", "0.33 l") is one amount, not a count of
// discrete things, so `qty` is pinned to 1 and the number stays fused to its
// unit in a single display string — otherwise it renders as an N-item count
// badge plus a stray unit tag ("×50 [g]") instead of one "50 g" amount. An
// Antall match ("3 stk", "2 boks") is a genuine count, so it keeps the
// number as `qty` as before.
function classifyUnit(rawNumber, rawUnit) {
  if (MENGDE_SET.has(rawUnit.toLowerCase())) {
    return { qty: 1, unit: `${rawNumber} ${rawUnit}`, unitType: "mengde" };
  }
  return { qty: Math.round(parseFloat(rawNumber.replace(",", "."))), unit: rawUnit, unitType: "antall" };
}

// If the typed text is already a known catalogue item, don't strip a leading
// or trailing integer thinking it's a quantity (e.g. a "7 Up" typed with a
// space). Otherwise a leading or trailing "<qty><unit>" (with a recognized
// unit) is parsed as quantity + unit regardless of size, since the unit
// disambiguates intent ("500g" is unambiguous). Without a unit, a bare
// "<qty>" below 20 is parsed as quantity ("2 melk" or "melk 2") — larger
// bare numbers ("Yoghurt 500") are too often part of the product name/size
// itself to treat as a quantity.
export function parseItemInput(raw, catalogue) {
  const text = raw.trim();
  if (catalogue.some((c) => c.name.toLowerCase() === text.toLowerCase())) {
    return { name: text, qty: 1, unit: null, unitType: null };
  }
  const leadingUnit = text.match(new RegExp(`^(${QTY_ALT})\\s?(${UNIT_ALT})\\b\\s+(.+)$`, "i"));
  if (leadingUnit) {
    return { name: leadingUnit[3].trim(), ...classifyUnit(leadingUnit[1], leadingUnit[2]) };
  }
  const trailingUnit = text.match(new RegExp(`^(.+?)\\s+(${QTY_ALT})\\s?(${UNIT_ALT})\\b$`, "i"));
  if (trailingUnit) {
    return { name: trailingUnit[1].trim(), ...classifyUnit(trailingUnit[2], trailingUnit[3]) };
  }
  const leading = text.match(/^(\d+)\s+(.+)$/);
  if (leading && Number(leading[1]) < 20) {
    return { name: leading[2].trim(), qty: parseInt(leading[1], 10), unit: null, unitType: null };
  }
  const trailing = text.match(/^(.+)\s+(\d+)$/);
  if (trailing && Number(trailing[2]) < 20) {
    return { name: trailing[1].trim(), qty: parseInt(trailing[2], 10), unit: null, unitType: null };
  }
  return { name: text, qty: 1, unit: null, unitType: null };
}

// Pulls a gluten-free marker (GF / gf / glutenfri / glutenfritt / "gluten
// free"/"gluten-free") out of a typed name so it can become a "GF" note
// instead of part of the item name — bilingual since a household in English
// mode still types in English.
export function extractGF(name) {
  let gf = false;
  const cleaned = (name || "")
    .replace(/\b(gf|glutenfri|glutenfritt|gluten.?free)\b/gi, () => {
      gf = true;
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  if (!gf || !cleaned) return { name: (name || "").trim(), gf: false };
  return { name: cleaned, gf: true };
}

// Token-based fuzzy match: every word in the query must appear somewhere in
// the candidate name (any order), so "milk semi" matches "Semi-skimmed milk".
// The stored catalogue name is always the canonical (English) one — when
// `lang` is "nb", also match against its Norwegian display translation (see
// itemNames.js) so typing "melk" surfaces "Milk", displayed as "Melk",
// without ever renaming the stored row.
export function matchCatalogue(query, catalogue, lang = "nb") {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return catalogue
    .filter((c) => {
      const searchable = lang === "nb"
        ? `${c.name} ${translateItemName(c.name, "nb")}`.toLowerCase()
        : c.name.toLowerCase();
      return tokens.every((t) => searchable.includes(t));
    })
    .sort((a, b) => a.name.length - b.name.length);
}

// Fallback-only descriptor split: tried *after* a whole-phrase matchCatalogue
// lookup already failed, so it never overrides a real match — including a
// coincidental one (e.g. "yoghurt naturell" already matches "Plain yogurt" via
// its Norwegian translation "Naturell yoghurt", and that's left alone). Only
// once the full phrase matches nothing does this shrink from the trailing
// end, one word at a time, and retry — the first (longest) leading prefix
// that matches wins, so a real compound catalogue entry ("chicken fillet")
// is still preferred over splitting further down to a shorter base word
// ("chicken") that also happens to exist on its own. Anything shed off the
// end becomes `descriptor`, meant to be folded into notes by the caller.
export function matchWithDescriptor(query, catalogue, lang = "nb") {
  const direct = matchCatalogue(query, catalogue, lang)[0];
  if (direct) return { match: direct, descriptor: "" };
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  for (let i = tokens.length - 1; i > 0; i--) {
    const match = matchCatalogue(tokens.slice(0, i).join(" "), catalogue, lang)[0];
    if (match) return { match, descriptor: tokens.slice(i).join(" ") };
  }
  return { match: null, descriptor: "" };
}

// Assembles list_items.notes from the transient signals parsed out of a
// typed add-item string. A bare "stk" unit is dropped rather than noted —
// it's Norwegian for "piece(s)", pure count already conveyed by qty itself —
// while other Antall units (boks, pose, pakke, ...) carry real packaging
// info beyond the count and are kept.
export function buildItemNotes({ descriptor, unit, gf } = {}) {
  const parts = [
    descriptor || null,
    unit && unit.toLowerCase() !== "stk" ? unit : null,
    gf ? "Glutenfri" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

// D1/SQLite's datetime('now') produces "YYYY-MM-DD HH:MM:SS" (UTC, no "Z",
// space instead of "T") — not reliably parseable by `new Date(...)` on Safari
// (Chrome/Firefox are lenient about it, but Safari can yield Invalid Date).
// Reformat to a proper ISO string first.
export function parseSqliteDatetime(s) {
  return new Date(`${String(s).replace(" ", "T")}Z`);
}

export function haptic(ms = 10) {
  if (localStorage.getItem("ph_haptics") !== "0" && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}
