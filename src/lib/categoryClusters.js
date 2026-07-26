// Maps each CATEGORIES entry (src/lib/shoppingUtils.js) to a short cluster
// key backing the --cluster-<key>-bg/-on tokens in
// src/design-system/tokens/clusters.css. Keep in sync with CATEGORIES, same
// convention CLAUDE.md documents for CATEGORIES itself.
//
// Exported because it doubles as the app's only *stable, language-neutral* id
// per category: the canonical CATEGORIES string is a literal data key
// (clusterFor, category_order, worker-side validation all match on it), so it
// can't be translated — but it can be mapped through these ids to a display
// label. See src/lib/i18n/categoryNames.js.
//
// The ids are what the category.<id> dictionary entries and the
// --cluster-<id>-* CSS tokens key off, so they survived the canonical strings
// switching from Norwegian to English untouched — which is exactly why they
// don't embed a language in the first place.
export const CLUSTER_KEYS = {
  "Fruit and vegetables": "produce",
  "Bread and bakery": "bakery",
  "Dairy": "dairy",
  "Meat and fish": "meat",
  "Ingredients and spices": "spice",
  "Frozen and ready meals": "frozen",
  "Grains and pasta": "grains",
  "Snacks and sweets": "snacks",
  "Drinks": "drinks",
  "Household": "household",
  "Health and personal care": "care",
  "Pet supplies": "pet",
  "Other": "other",
};

// "Recently bought" isn't a real category (it's the recently-bought section) —
// falls through to the neutral "other" cluster, which is correct since it's
// not a store aisle. "Important" (the pinned important-items section, see
// ShoppingListTab's pinImportant) isn't one either, but it does get its own
// look rather than falling through: it reuses --accent-tertiary/-subtle, the
// same star color already used for the importance badge/swipe-reveal in
// ItemCard.jsx, so the pinned section visually reads as "the star color" at a
// glance instead of a new unrelated hue.
//
// Both are internal clusterKey props passed between components, never stored
// and never displayed — the section headings users read come from the
// shoppingList.section.* dictionary entries.
export function clusterFor(category) {
  if (category === "Important") return { bg: "var(--accent-tertiary-subtle)", on: "var(--accent-tertiary)" };
  const key = CLUSTER_KEYS[category] || "other";
  return { bg: `var(--cluster-${key}-bg)`, on: `var(--cluster-${key}-on)` };
}
