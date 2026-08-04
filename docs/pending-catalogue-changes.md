# Pending catalogue changes (not yet implemented)

A running log of decisions from item-catalogue reviews, meant to build up over
time rather than trigger a migration/deploy for every single item. When this
list gets big enough (or a related change is already touching `COMMON_ITEMS`
for another reason), fold it into a real change: edit `COMMON_ITEMS` in
`worker/index.js`, bump `VERSION`, add a `CHANGELOG.md` entry, and clear the
relevant section here. See "Catalogue sync" in `CLAUDE.md` — no migration file
is needed for `COMMON_ITEMS` edits, `checkCatalogueSync`'s cron picks up the
change automatically on the next deploy.

Nothing in this file has been applied yet. `item_catalogue` in production is
untouched.

## Review 1 — 2026-08-04

Source: full review of the household's 748-row `item_catalogue` (list_id 1)
against the 710-entry `COMMON_ITEMS`. 710 rows matched a standard item
exactly; the 38 that didn't were triaged below.

### Add to `COMMON_ITEMS`

Frequently-bought or clearly-useful items missing from the standard list.
Category suggestions follow the closest existing `COMMON_ITEMS` convention
(noted in parens where it differs from how the household's own custom row
was categorized).

| Add as (canonical English) | Category | Evidence (household's custom row) |
|---|---|---|
| Granola | Grains and pasta | "Granola", bought 20× |
| Taco shells | Ingredients and spices (matches "Taco seasoning") | "Tacolefser", bought 5× |
| Taco sauce | Ingredients and spices | "Tacosaus", bought 5× |
| Crème fraîche | Dairy | "Creme fraiche", bought 4× |
| Potato salad | Ingredients and spices *(uncertain fit — no existing "prepared side dish" category to match against; revisit when adding)* | "Potetsalat", bought 3× |
| Brownie | Bread and bakery | "Brownie", bought 3× |
| Beans (generic, alongside existing Black/Kidney/Frozen/Soybeans) | Grains and pasta | "Bønner", bought 3× |
| Pasta sauce | Ingredients and spices | "Pastasaus", bought 1× — low usage here, but a surprising gap in the standard list regardless |
| Vanilla ice cream | Dairy (matches "Ice cream", not "Frozen and ready meals" — household filed it as the latter) | "Vaniljeis", bought 2× |
| Brown gravy | Ingredients and spices | "Brun saus", bought 2× |
| Crackers | Snacks and sweets (matches "Potato chips") | "Ritz", bought 2× — genericized from the brand name; standard list currently has no cracker item at all |

`Rundstykker fryst` (frozen bread rolls, bought 3×) was considered and
**declined** — not being added.

### Remove from this household's catalogue (not added to `COMMON_ITEMS`)

Never-bought or too-vague to be useful as a catalogue entry:

- `Krydder` ("spice" — too generic, 0× bought)
- `Pasta gf` (unclear abbreviation, 0× bought)

`Tikka Masala` (0× bought) was considered but **kept** — not being removed.

`Rundstykker fryst` (see above) is also queued for removal here, since it was
declined as a promotion candidate rather than left as a household-specific
item.

### Duplicates of existing `COMMON_ITEMS` entries — merge/remove

These 12 rows represent the same product as an existing standard item, just
typed differently (Norwegian plural, brand name, or with a size/packaging
qualifier attached) — each one splits purchase-history stats (`times_bought`
etc.) across two catalogue rows instead of one.

| Household's row | Duplicate of | Why it didn't match |
|---|---|---|
| Epler | Apple | Norwegian plural ("Epler") vs. the stored singular translation ("Eple") |
| Gulrøtter | Carrot | Norwegian plural ("Gulrøtter") vs. singular ("Gulrot") |
| Poteter | Potato | Norwegian plural ("Poteter") vs. singular ("Potet") |
| Gram sjokolade | Chocolate | Extra word ("Gram") not part of the translation |
| JUICE EPLE | Apple juice | Word order / all-caps, not an exact substring match |
| Vaniljeekstrakt/vaniljeessens | Vanilla extract | Slash-joined into a single token with no space, so it's never seen as matching the shorter translation |
| KLEMMEPOSER | Zip bags | Different Norwegian word than the one stored ("Zip poser") — not a translation gap, a missing synonym |
| Qtips | Cotton swabs | Brand name, not a translation of "Cotton swabs" |
| Zalo | Dish soap | Brand name, not a translation of "Dish soap" |
| Mango frist price | Mango | Store-brand qualifier ("First Price") appended |
| Naturell yoghurt liten | Plain yogurt | Extra qualifier ("liten" = small) appended |
| Is | Ice cream *(unconfirmed — could also mean "ice/ice cubes")* | Shortened/ambiguous word, not the stored translation ("Iskrem") |

**Root cause (answers "why does a Norwegian-typed item end up as its own English-adjacent thing?"):**
`item_catalogue.name` is always the canonical English name by design (see
"Language support" in `CLAUDE.md`). When adding an item, `matchCatalogue`
(`src/lib/shoppingUtils.js`) is what's supposed to resolve Norwegian input to
that English row — it checks whether every *typed word* appears as a
substring of either the English name or its one stored Norwegian translation
(`src/lib/i18n/itemNames.js`). If nothing matches, the app has no fallback:
it just creates a brand new catalogue row using exactly what was typed. So
a Norwegian name only "becomes" an English item when the substring match
succeeds; otherwise it's stored verbatim, in Norwegian, permanently.

The four failure modes seen above:
1. **Plural vs. singular** — `itemNames.js` stores one Norwegian string per
   item (the singular), and matching is plain substring, not stemmed —
   "Epler" is not a substring of "Eple". This is the biggest gap: Norwegian
   plurals are the natural way to phrase a shopping-list entry for countable
   produce ("epler", "gulrøtter", "poteter"), so this will keep recurring.
2. **Extra qualifiers** — `matchCatalogue` requires *every* typed token to
   match; one added word with no catalogue counterpart (size, brand) blocks
   the whole match. (`matchWithDescriptor` exists specifically to strip a
   trailing word and retry — worth checking why it didn't catch
   "Naturell yoghurt liten"/"Mango frist price" if this recurs.)
3. **Odd tokenization** — a slash-joined phrase with no space becomes one
   giant token that can't substring-match a shorter translation.
4. **Missing synonyms/brand names** — not a bug; "Zalo"/"Qtips"/"Klemmeposer"
   were never going to auto-match since they're different words, not
   translations, of the standard item.

**Best solution, for whenever this is worth fixing in code (not proposing to
do this now, just recording the options):**
- Cheapest real fix for (1): make `matchCatalogue` strip common Norwegian
  plural suffixes (`-er`, `-r`, and irregular cases like rot→røtter) before
  comparing, rather than trying to enumerate every plural in `itemNames.js`
  (that dictionary is 1:1 per item; turning it into a list of synonyms per
  item would be a bigger, noisier change).
- (2)/(3) are arguably matcher edge cases worth a couple of unit tests
  (`shoppingUtils.test.js`) rather than a redesign.
- (4) isn't a translation bug at all — brand names and alternate Norwegian
  words are exactly what per-household custom catalogue entries are for;
  no fix needed.
- None of this is data cleanup — it's a `src/lib/shoppingUtils.js` change,
  frontend-only, no migration involved.

For now: these 12 rows stay as-is in production. Revisit merging them (and
whether to fix the matcher) together, next time this file gets acted on.
