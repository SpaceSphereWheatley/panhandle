// Pure helpers ported from public/app.html's shopping-list script section.
export { CATEGORIES } from "../../shared/categories.js";

// Upper-cases the first character of an item/catalogue name for display,
// leaving the rest as stored. Mirrors the server's capitalizeName.
export function cap(s) {
  const t = s == null ? "" : String(s);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// Recognized quantity units, fused or spaced with a number ("2L", "500g",
// "2 kg", "3 stk"). Order doesn't matter for correctness here since no two
// alternatives share a starting letter at the same anchored match position.
const UNIT_ALT = "stk|kg|ml|g|l";

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
    return { name: text, qty: 1, unit: null };
  }
  const leadingUnit = text.match(new RegExp(`^(\\d+)\\s?(${UNIT_ALT})\\b\\s+(.+)$`, "i"));
  if (leadingUnit) {
    return { name: leadingUnit[3].trim(), qty: parseInt(leadingUnit[1], 10), unit: leadingUnit[2] };
  }
  const trailingUnit = text.match(new RegExp(`^(.+?)\\s+(\\d+)\\s?(${UNIT_ALT})\\b$`, "i"));
  if (trailingUnit) {
    return { name: trailingUnit[1].trim(), qty: parseInt(trailingUnit[2], 10), unit: trailingUnit[3] };
  }
  const leading = text.match(/^(\d+)\s+(.+)$/);
  if (leading && Number(leading[1]) < 20) {
    return { name: leading[2].trim(), qty: parseInt(leading[1], 10), unit: null };
  }
  const trailing = text.match(/^(.+)\s+(\d+)$/);
  if (trailing && Number(trailing[2]) < 20) {
    return { name: trailing[1].trim(), qty: parseInt(trailing[2], 10), unit: null };
  }
  return { name: text, qty: 1, unit: null };
}

// Pulls a gluten-free marker (GF / gf / glutenfri / glutenfritt) out of a
// typed name so it can become a "GF" note instead of part of the item name.
export function extractGF(name) {
  let gf = false;
  const cleaned = (name || "")
    .replace(/\b(gf|glutenfri|glutenfritt)\b/gi, () => {
      gf = true;
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  if (!gf || !cleaned) return { name: (name || "").trim(), gf: false };
  return { name: cleaned, gf: true };
}

// Token-based fuzzy match: every word in the query must appear somewhere in
// the candidate name (any order), so "melk lett" matches "Lettmelk".
export function matchCatalogue(query, catalogue) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return catalogue
    .filter((c) => {
      const ln = c.name.toLowerCase();
      return tokens.every((t) => ln.includes(t));
    })
    .sort((a, b) => a.name.length - b.name.length);
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
