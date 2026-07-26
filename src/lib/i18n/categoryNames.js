import { CLUSTER_KEYS } from "../categoryClusters.js";
import { translate } from "./translate.js";

// Display-only category labels, same shape and same rule as itemNames.js: the
// canonical (English) CATEGORIES string is the stored/validated identity and
// is never rewritten — `clusterFor()`, the `category_order` table, and the
// Worker's own validation all match on it literally, so translating the value
// would silently break the aisle ordering and reject writes. Only the string
// a user *reads* changes.
//
// Routed through CLUSTER_KEYS (`"Fruit and vegetables"` → `"produce"`) rather
// than keying the dictionary on the canonical text directly. That id already
// exists for CSS token lookup and is language-neutral, so the dictionary
// entries (`category.produce`) don't have to embed a specific language in
// their key — which is what let the canonical strings switch from Norwegian to
// English without touching a single dictionary entry.
//
// An unknown category (one not in CLUSTER_KEYS — e.g. a value from a newer
// deploy this bundle doesn't know yet) passes through unchanged rather than
// rendering a missing-key placeholder, matching translateItemName's
// pass-through behaviour for custom items.
export function translateCategoryName(category, lang) {
  const key = CLUSTER_KEYS[category];
  if (!key) return category;
  return translate(lang, `category.${key}`);
}
