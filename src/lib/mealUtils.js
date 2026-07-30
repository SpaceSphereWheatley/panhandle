import { matchCatalogue, parseItemInput } from "./shoppingUtils.js";
import { api } from "./api.js";

// (WEEKDAYS_NO used to live here. Its only consumer, DinnerDutySubpage, now
// builds the same Monday-first list per language via i18n/dateLocale.js's
// weekdayNames(lang) instead of a hardcoded Norwegian array.)

// Turns a flat list of raw ingredient strings (as typed into meal_catalogue)
// into deduped, catalogue-matched rows ready for a checkable "add to
// shopping list" UI. `onListNames` is a Set of lowercased names already
// unbought on the shopping list, used to set the `already` flag. Runs each
// raw ingredient through parseItemInput first — the same qty/unit stripping
// the manual shopping-list input does — so a meal ingredient typed as e.g.
// "2 kg poteter" imports as qty 2/unit kg against a matched "Poteter" line,
// instead of failing to match the catalogue on the untouched string and
// landing as a qty-1 "Other" item literally named "2 kg poteter".
export function buildIngredientRows(rawIngredients, catalogue, onListNames) {
  const seen = new Set();
  const rows = [];
  for (const raw of rawIngredients) {
    const { name: parsedName, qty, unit } = parseItemInput(raw, catalogue);
    const match = matchCatalogue(parsedName, catalogue)[0];
    const name = match ? match.name : parsedName;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, category: match ? match.category : "Other", qty, unit, already: onListNames.has(key) });
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

// Monday-first day-of-week (0 = Monday .. 6 = Sunday), matching
// recurring_schedule.day_of_week's convention. `date` may be a Date or
// anything the Date constructor accepts (e.g. an ISO string).
export function dayOfWeekMonFirst(date) {
  return (new Date(date).getDay() + 6) % 7;
}

// Navigable range: one week back (recent history) through several weeks
// ahead for planning. The `/plan` read still prunes rows older than 14 days,
// which only affects past weeks.
export const WEEK_MIN = -1;
export const WEEK_MAX = 4;

// Default sort for meal-catalogue browse/pick lists: most-planned first,
// then alphabetical.
export function sortMealsByUsage(meals) {
  return [...meals].sort((a, b) => b.times_planned - a.times_planned || a.name.localeCompare(b.name));
}

// Distinct labels used across a meal catalogue, alphabetically sorted.
export function collectLabels(meals) {
  const set = new Set();
  for (const m of meals) for (const l of parseIngredients(m.labels)) set.add(l);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Case-insensitive, trimmed exact-name lookup — "does a saved meal already
// have exactly this name" (duplicate detection, meal-name autofill on typing).
export function findMealByName(catalogue, name) {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return catalogue.find((m) => m.name.toLowerCase() === n);
}

// Case-insensitive substring match against a single meal name, for
// search/autocomplete filtering. An empty query matches everything.
export function mealNameMatches(mealName, query) {
  const q = query.trim().toLowerCase();
  return !q || mealName.toLowerCase().includes(q);
}

// Bidirectional substring match ("Taco" flags both "Tacos" and "Fish
// tacos") used for the meal editor's "similar name" nudge.
export function findSimilarMeals(catalogue, name) {
  const n = name.trim().toLowerCase();
  if (!n) return [];
  return catalogue.filter((m) => {
    const on = m.name.toLowerCase();
    return on.includes(n) || n.includes(on);
  });
}

// Adds each checked ingredient row to the shopping list one at a time,
// tallying outcomes so the caller can toast a single summary instead of one
// per item. A `{ duplicate: true }` response means the qty was bumped on a
// line already on the list rather than a genuinely new item, so it's counted
// separately from `added`. `r.qty`/`r.unit` come from buildIngredientRows'
// parseItemInput pass; unit (if any) rides along as a note, matching how the
// manual shopping-list input records it.
export async function addRowsToList(rows) {
  let added = 0,
    merged = 0,
    failed = 0;
  for (const r of rows) {
    try {
      const res = await api("/list", {
        method: "POST",
        body: JSON.stringify({ name: r.name, qty: r.qty || 1, category: r.category, notes: r.unit || undefined }),
      });
      if (res?.duplicate) merged++;
      else added++;
    } catch {
      failed++;
    }
  }
  return { added, merged, failed };
}
