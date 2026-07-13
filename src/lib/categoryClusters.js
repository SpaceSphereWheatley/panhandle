// Maps each CATEGORIES entry (src/lib/shoppingUtils.js) to a short cluster
// key backing the --cluster-<key>-bg/-on tokens in
// src/design-system/tokens/clusters.css. Keep in sync with CATEGORIES, same
// convention CLAUDE.md documents for CATEGORIES itself.
const CLUSTER_KEYS = {
  "Frukt og grønt": "produce",
  "Brød og bakevarer": "bakery",
  "Meieriprodukter": "dairy",
  "Kjøtt og fisk": "meat",
  "Ingredienser og krydder": "spice",
  "Frysevarer og ferdigmåltid": "frozen",
  "Kornprodukter": "grains",
  "Snacks og godteri": "snacks",
  "Drikkevarer": "drinks",
  "Husholdning": "household",
  "Omsorg og helse": "care",
  "Dyreprodukter": "pet",
  "Annet": "other",
};

// "Nylig kjøpt" isn't a real category (it's the recently-bought section) —
// falls through to the neutral "other" cluster, which is correct since it's
// not a store aisle.
export function clusterFor(category) {
  const key = CLUSTER_KEYS[category] || "other";
  return { bg: `var(--cluster-${key}-bg)`, on: `var(--cluster-${key}-on)` };
}
