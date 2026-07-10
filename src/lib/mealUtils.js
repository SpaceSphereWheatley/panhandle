export const WEEKDAYS_NO = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

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
