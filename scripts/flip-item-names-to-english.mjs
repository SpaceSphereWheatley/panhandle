// One-off dev tool for the English-first restructure. NOT part of the build —
// nothing in package.json runs it, same category as compute-icon-offsets.mjs.
// Kept in the tree as the record of how 710 item names were flipped, so the
// result is reproducible and reviewable rather than a hand-edited diff.
//
// Run: node scripts/flip-item-names-to-english.mjs
//
// Three files key on the same lowercased item name and must stay in lockstep:
//   - COMMON_ITEMS      (worker/index.js)      — the catalogue seed, `name`
//   - ITEM_NAME_EN      (src/lib/i18n/itemNames.js) — the display lookup
//   - MAP               (src/lib/itemIcons.js) — name -> icon key
// This rewrites all three from Norwegian- to English-canonical, inverts the
// display lookup to en->nb, and emits the matching D1 migration.
import { readFileSync, writeFileSync } from "node:fs";

const ROOT = new URL("..", import.meta.url);
const f = (p) => new URL(p, ROOT);

// Two Norwegian names share an English translation, which would collide on
// item_catalogue's UNIQUE(list_id, name). Both are Norwegian brand/product
// names, so they keep their own name as the canonical English one rather than
// being given an invented disambiguator.
const COLLISION_OVERRIDES = {
  grandiosa: "Grandiosa",
  polarbrød: "Polarbrød",
};

// ---- parse -----------------------------------------------------------------

const workerSrc = readFileSync(f("worker/index.js"), "utf8");
const itemsStart = workerSrc.indexOf("export const COMMON_ITEMS = [");
const itemsEnd = workerSrc.indexOf("];", itemsStart);
const itemsBlock = workerSrc.slice(itemsStart, itemsEnd);
const commonItems = [...itemsBlock.matchAll(/name:\s*"([^"]+)",\s*category:\s*"([^"]+)"/g)]
  .map((m) => ({ name: m[1], category: m[2] }));

const namesSrc = readFileSync(f("src/lib/i18n/itemNames.js"), "utf8");
const nbToEn = Object.fromEntries(
  [...namesSrc.matchAll(/^\s*"([^"]+)":\s*"([^"]+)",?\s*$/gm)].map((m) => [m[1], m[2]])
);

// ---- build + verify --------------------------------------------------------

const rename = new Map(); // canonical nb name -> canonical en name
for (const { name } of commonItems) {
  const key = name.toLowerCase();
  const en = COLLISION_OVERRIDES[key] ?? nbToEn[key];
  if (!en) throw new Error(`no English name for ${name}`);
  rename.set(name, en);
}

if (rename.size !== commonItems.length) {
  throw new Error(`duplicate names in COMMON_ITEMS: ${commonItems.length} entries, ${rename.size} unique`);
}

const seen = new Map();
for (const [nb, en] of rename) {
  const key = en.toLowerCase();
  if (seen.has(key)) throw new Error(`English collision: "${seen.get(key)}" and "${nb}" both -> "${en}"`);
  seen.set(key, nb);
}
console.log(`${rename.size} names, all unique in English`);

// ---- 1. COMMON_ITEMS -------------------------------------------------------

const newItemsBlock = itemsBlock.replace(
  /name:\s*"([^"]+)"/g,
  (whole, nb) => (rename.has(nb) ? `name: "${rename.get(nb)}"` : whole)
);
writeFileSync(f("worker/index.js"), workerSrc.slice(0, itemsStart) + newItemsBlock + workerSrc.slice(itemsEnd));
console.log("rewrote COMMON_ITEMS");

// ---- 2. itemIcons MAP ------------------------------------------------------

// Keys only (the values are language-neutral icon ids). The section comments
// are Norwegian category names, so they follow CATEGORIES to English too.
const CATEGORY_COMMENTS = {
  "Frukt og grønt": "Fruit and vegetables",
  "Brød og bakevarer": "Bread and bakery",
  "Meieriprodukter": "Dairy",
  "Kjøtt og fisk": "Meat and fish",
  "Ingredienser og krydder": "Ingredients and spices",
  "Frysevarer og ferdigmåltid": "Frozen and ready meals",
  "Kornprodukter": "Grains and pasta",
  "Snacks og godteri": "Snacks and sweets",
  "Drikkevarer": "Drinks",
  "Husholdning": "Household",
  "Omsorg og helse": "Health and personal care",
  "Dyreprodukter": "Pet supplies",
  "Annet": "Other",
};

const iconsSrc = readFileSync(f("src/lib/itemIcons.js"), "utf8");
const mapStart = iconsSrc.indexOf("var MAP = {");
const mapEnd = iconsSrc.indexOf("\n  };", mapStart);
let mapBlock = iconsSrc.slice(mapStart, mapEnd);

const lowerRename = new Map([...rename].map(([nb, en]) => [nb.toLowerCase(), en.toLowerCase()]));
mapBlock = mapBlock.replace(/"([^"]+)"(\s*):/g, (whole, key, gap) =>
  lowerRename.has(key) ? `"${lowerRename.get(key)}"${gap}:` : whole
);
for (const [no, en] of Object.entries(CATEGORY_COMMENTS)) {
  mapBlock = mapBlock.replace(`// ${no}`, `// ${en}`);
}
writeFileSync(f("src/lib/itemIcons.js"), iconsSrc.slice(0, mapStart) + mapBlock + iconsSrc.slice(mapEnd));
console.log("rewrote itemIcons MAP");

// ---- 3. itemNames.js (inverted) --------------------------------------------

const header = `// Norwegian display names for the ~${rename.size} common catalogue items
// (COMMON_ITEMS, worker/index.js). Keyed by the lowercased canonical (English)
// name — the item_catalogue row's stored name never changes; this is a
// presentation-only lookup, so translation can never desync the
// checkCatalogueSync upsert (which is keyed on the stored name) or break
// icon matching (itemIcons.js) / duplicate-detection, both of which key off
// the same canonical name. A custom/free-typed item has no entry here and
// simply passes through untranslated in translateItemName below.
//
// Generated by scripts/flip-item-names-to-english.mjs; edit COMMON_ITEMS and
// re-run rather than hand-editing, so the three name lists stay in lockstep
// (itemNames.test.js fails the build if they drift).
const ITEM_NAME_NB = {\n`;

const body = commonItems
  .map(({ name }) => `  ${JSON.stringify(rename.get(name).toLowerCase())}: ${JSON.stringify(name)},`)
  .join("\n");

const footer = `
};

export function translateItemName(name, lang) {
  if (lang !== "nb" || !name) return name;
  return ITEM_NAME_NB[String(name).trim().toLowerCase()] ?? name;
}

// The canonical English names, exported so tests can assert that COMMON_ITEMS,
// this lookup and itemIcons' MAP all cover exactly the same set.
export const CANONICAL_ITEM_NAMES = Object.keys(ITEM_NAME_NB);
`;

writeFileSync(f("src/lib/i18n/itemNames.js"), header + body + footer);
console.log("rewrote itemNames.js (now en -> nb)");

// ---- 4. migration ----------------------------------------------------------

const sql = `-- English-first restructure, part 2 of 2: rewrite the canonical item names
-- stored in item_catalogue from Norwegian to English, matching the new
-- COMMON_ITEMS array in worker/index.js.
--
-- Generated by scripts/flip-item-names-to-english.mjs from COMMON_ITEMS itself,
-- so it can't drift from the array it mirrors.
--
-- Like 0022 this is a *data* rewrite of values live code matches on literally,
-- so it is NOT expand/contract and must be applied immediately before the
-- merge rather than ahead of it (see CLAUDE.md's Databases section, and 0022's
-- header, for the reasoning and the ~1 minute exposure).
--
-- Why it is mandatory rather than cleanup: checkCatalogueSync upserts on
-- (list_id, name) and re-runs whenever the COMMON_ITEMS hash changes. The new
-- code's hash *will* differ, so the first cron tick after deploy re-seeds all
-- ${rename.size} English names. With this migration applied that's a no-op; without it,
-- every list gains ${rename.size} duplicate rows alongside its Norwegian ones.
--
-- list_items references item_catalogue by id, not by name, so renaming here
-- cannot orphan a list row. Two names that shared an English translation
-- (Grandiosa/Frossenpizza, Polarbrød/Flatbrød) keep their own brand name as
-- the canonical English one, so no UPDATE below can collide on
-- UNIQUE(list_id, name).
${commonItems
  .map(({ name }) => {
    const en = rename.get(name).replace(/'/g, "''");
    return `UPDATE item_catalogue SET name = '${en}' WHERE name = '${name.replace(/'/g, "''")}';`;
  })
  .join("\n")}
`;

writeFileSync(f("migrations/0023_english_item_catalogue.sql"), sql);
console.log("wrote migrations/0023_english_item_catalogue.sql");
