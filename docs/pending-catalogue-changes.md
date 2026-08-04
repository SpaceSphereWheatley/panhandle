# Pending catalogue changes (not yet implemented)

A running log of decisions from item-catalogue reviews, meant to build up
over time rather than trigger a migration/deploy for every single item. When
this list gets big enough, fold it into a real change: edit `COMMON_ITEMS` in
`worker/index.js`, bump `VERSION`, add a `CHANGELOG.md` entry, and clear the
relevant section here.

Nothing in this file has been applied yet. `item_catalogue` in production is
untouched.

## Review 1 — 2026-08-04

Full review of the household's 748-row `item_catalogue` (list_id 1) against
the 710-entry `COMMON_ITEMS`.

### Items to be added (to `COMMON_ITEMS`)

- Granola — Grains and pasta
- Taco shells — Ingredients and spices
- Taco sauce — Ingredients and spices
- Crème fraîche — Dairy
- Potato salad — Ingredients and spices (uncertain fit, revisit)
- Brownie — Bread and bakery
- Beans (generic, alongside Black/Kidney/Frozen/Soybeans) — Grains and pasta
- Pasta sauce — Ingredients and spices
- Vanilla ice cream — Dairy
- Brown gravy — Ingredients and spices
- Crackers — Snacks and sweets

### Items to be removed (from this household's catalogue)

- Krydder ("spice" — too generic)
- Pasta gf (unclear abbreviation)
- Rundstykker fryst (frozen bread rolls — declined as a promotion candidate)

### Items to be changed (merge into an existing `COMMON_ITEMS` entry)

These are duplicates of a standard item, just typed differently — merging
them stops the purchase history from being split across two rows.

- Epler → Apple
- Gulrøtter → Carrot
- Poteter → Potato
- Gram sjokolade → Chocolate
- JUICE EPLE → Apple juice
- Vaniljeekstrakt/vaniljeessens → Vanilla extract
- KLEMMEPOSER → Zip bags
- Qtips → Cotton swabs
- Zalo → Dish soap
- Mango frist price → Mango
- Naturell yoghurt liten → Plain yogurt
- Is → Ice cream (unconfirmed — could also mean "ice/ice cubes")

### Why these duplicates happened

`item_catalogue.name` is always the canonical English name. Adding an item
is supposed to match Norwegian input to that English row via `matchCatalogue`
(`src/lib/shoppingUtils.js`), which checks whether every typed word is a
substring of the English name or its one stored Norwegian translation
(`src/lib/i18n/itemNames.js`). When nothing matches, there's no fallback —
it just creates a new row with exactly what was typed.

Main causes seen above:
- **Norwegian plurals** ("Epler" vs. stored singular "Eple") — the biggest
  gap, since plurals are the natural way to phrase a shopping-list entry.
- **Extra qualifiers** (size, brand) tacked onto the name — every typed word
  must match, so one extra word blocks the whole match.
- **Brand names / different Norwegian words** (Zalo, Qtips, Klemmeposer) —
  not a bug, these just aren't translations of the standard item.

Possible fix, not scheduled: make `matchCatalogue` strip common Norwegian
plural suffixes before comparing, instead of relying on exact-string
translations. Frontend-only change (`src/lib/shoppingUtils.js`), no
migration involved.
