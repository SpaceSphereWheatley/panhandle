// Pure helpers for the storage module (docs/storage-module-plan.md). Box
// data itself now lives server-side (GET/POST/PATCH/DELETE /storage/boxes,
// wired up directly in StorageTab.jsx and BoxEditModal.jsx via api.js, same
// as ItemEditModal/MealsTab) — everything here is stateless
// formatting/filtering shared by those components.

// Numbers are stored as plain integers, but always *rendered* zero-padded
// to at least 3 digits — "001", "042", "1004" — regardless of storage
// shape. One shared helper so every render path (cards, search, labels,
// deep links) formats identically.
export function formatBoxNumber(number) {
  return String(number).padStart(3, "0");
}

// Client-side filter over the already-loaded box list — search is the
// primary interaction, but at household scale (tens to low hundreds of
// boxes) there's no need for server-side search.
export function matchesQuery(box, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (formatBoxNumber(box.number).includes(q)) return true;
  if (box.name.toLowerCase().includes(q)) return true;
  if (box.location.toLowerCase().includes(q)) return true;
  return box.items.some((item) => item.toLowerCase().includes(q));
}
