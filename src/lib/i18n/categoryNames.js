import { CLUSTER_KEYS } from "../categoryClusters.js";
import { translate } from "./translate.js";

// Display-only category labels, same shape and same rule as itemNames.js: the
// canonical Norwegian CATEGORIES string is the stored/validated identity and
// is never rewritten — `clusterFor()`, the `category_order` table, and the
// Worker's own validation all match on it literally, so translating the value
// would silently break the aisle ordering and reject writes. Only the string
// a user *reads* changes.
//
// Routed through CLUSTER_KEYS (`"Frukt og grønt"` → `"produce"`) rather than
// keying the dictionary on the Norwegian text directly. That id already
// exists for CSS token lookup and is language-neutral, so the dictionary
// entries (`category.produce`) don't have to embed a Norwegian sentence in
// their key — and renaming a Norwegian label later wouldn't orphan them.
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
