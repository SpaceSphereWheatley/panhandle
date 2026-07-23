// Single source of truth for shopping-list categories. Imported by both the
// Worker (server-side validation/default, worker/index.js) and the frontend
// (display grouping, src/lib/shoppingUtils.js) so they can't drift.
export const CATEGORIES = [
  "Frukt og grønt", "Brød og bakevarer", "Meieriprodukter", "Kjøtt og fisk",
  "Ingredienser og krydder", "Frysevarer og ferdigmåltid", "Kornprodukter",
  "Snacks og godteri", "Drikkevarer", "Husholdning", "Omsorg og helse",
  "Dyreprodukter", "Annet"
];

// Given a per-list custom category order (an array of category names, possibly
// partial, reordered, or holding stale/unknown names), return a complete,
// valid ordering: the stored order's recognized entries first (in stored
// order, de-duplicated), then any CATEGORIES not yet placed appended in their
// canonical order. Unknown names are dropped. This keeps a saved order robust
// against CATEGORIES gaining a new entry later (it lands at the end rather than
// vanishing) and against a malformed payload. Shared by the Worker (GET/POST
// /category-order) and the frontend (CategoryOrderContext) so the two can't
// drift — same single-source pattern as CATEGORIES itself.
export function normalizeCategoryOrder(stored) {
  const valid = new Set(CATEGORIES);
  const seen = new Set();
  const order = [];
  for (const c of Array.isArray(stored) ? stored : []) {
    if (valid.has(c) && !seen.has(c)) {
      seen.add(c);
      order.push(c);
    }
  }
  for (const c of CATEGORIES) {
    if (!seen.has(c)) order.push(c);
  }
  return order;
}
