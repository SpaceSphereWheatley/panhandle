// Single source of truth for shopping-list categories. Imported by both the
// Worker (server-side validation/default, worker/index.js) and the frontend
// (display grouping, src/lib/shoppingUtils.js) so they can't drift.
//
// These strings are literal *data keys*, not display text: clusterFor() keys
// off them, the category_order table stores them, and the Worker validates
// incoming categories against them. They are never translated — a category's
// display label goes through translateCategoryName() (src/lib/i18n/
// categoryNames.js), which maps the canonical English string to a Norwegian
// label via its language-neutral cluster id.
export const CATEGORIES = [
  "Fruit and vegetables", "Bread and bakery", "Dairy", "Meat and fish",
  "Ingredients and spices", "Frozen and ready meals", "Grains and pasta",
  "Snacks and sweets", "Drinks", "Household", "Health and personal care",
  "Pet supplies", "Other"
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
