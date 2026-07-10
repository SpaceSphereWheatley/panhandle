// Pure helpers ported from public/app.html's shopping-list script section.
export const CATEGORIES = [
  "Frukt og grønt",
  "Brød og bakevarer",
  "Meieriprodukter",
  "Kjøtt og fisk",
  "Ingredienser og krydder",
  "Frysevarer og ferdigmåltid",
  "Kornprodukter",
  "Snacks og godteri",
  "Drikkevarer",
  "Husholdning",
  "Omsorg og helse",
  "Dyreprodukter",
  "Annet",
];

// Upper-cases the first character of an item/catalogue name for display,
// leaving the rest as stored. Mirrors the server's capitalizeName.
export function cap(s) {
  const t = s == null ? "" : String(s);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

// If the typed text is already a known catalogue item, don't strip a leading
// integer thinking it's a quantity (e.g. a "7 Up" typed with a space). Only a
// *leading* "<qty> <name>" is parsed as quantity ("2 melk") — a trailing
// number is too often part of the product name itself.
export function parseItemInput(raw, catalogue) {
  const text = raw.trim();
  if (catalogue.some((c) => c.name.toLowerCase() === text.toLowerCase())) {
    return { name: text, qty: 1 };
  }
  const m = text.match(/^(\d+)\s+(.+)$/);
  if (m) return { name: m[2].trim(), qty: parseInt(m[1], 10) };
  return { name: text, qty: 1 };
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

export function haptic(ms = 10) {
  if (localStorage.getItem("ph_haptics") !== "0" && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}
