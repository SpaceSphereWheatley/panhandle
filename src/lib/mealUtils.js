import { matchCatalogue } from "./shoppingUtils.js";

export const WEEKDAYS_NO = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

// Turns a flat list of raw ingredient strings (as typed into meal_catalogue)
// into deduped, catalogue-matched rows ready for a checkable "add to
// shopping list" UI. `onListNames` is a Set of lowercased names already
// unbought on the shopping list, used to set the `already` flag.
export function buildIngredientRows(rawIngredients, catalogue, onListNames) {
  const seen = new Set();
  const rows = [];
  for (const raw of rawIngredients) {
    const match = matchCatalogue(raw, catalogue)[0];
    const name = match ? match.name : raw;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, category: match ? match.category : "Annet", already: onListNames.has(key) });
  }
  return rows;
}

export function parseIngredients(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Formats a Date as YYYY-MM-DD from its *local* components. Date#toISOString
// converts to UTC first, which shifts the date backwards by a day between
// local midnight and the UTC offset — exactly when "today"/the week grid/the
// saved plan_date need to agree with the browser's local calendar, not UTC's.
export function localIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mondayOf(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

// Navigable range: one week back (recent history) through several weeks
// ahead for planning. The `/plan` read still prunes rows older than 14 days,
// which only affects past weeks.
export const WEEK_MIN = -1;
export const WEEK_MAX = 4;
