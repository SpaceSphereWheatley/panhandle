# i18n roadmap (language support)

Tracks TODO #15 (language support) across sessions. Phase 1 (translation
infra + the Settings → "Språk" switcher + `ShoppingListTab` chrome, 1.43.4)
and phase 2 (the ~710 `COMMON_ITEMS` catalogue names + finishing
`ItemCard`/`SuggestionsModal`/`ItemEditModal` + the dropdown switcher, 1.44.0)
have shipped. Everything below is what's left. Organized so any session can
pick up one phase without re-deriving the architecture — read "Decisions
already made" and "How to extract a component" first, then jump to whichever
phase you're doing. Check items off as they ship, and add a `Todo_done.md`
entry + a one-line update to `TODO.md` #15 the same way phases 1/2 did.

## Decisions already made (read before touching any phase)

- **Infra**: `src/lib/i18n/` — flat dot-namespaced string-map dictionaries
  (`dictionaries/nb.js`/`en.js`), a pure `translate(lang, key, params)` +
  `interpolate()` (`translate.js`), and `LanguageContext.jsx`
  (`LanguageProvider`/`useLanguage()`/`useTranslation()`). `useTranslation()`
  returns just `t(key, params)`; `useLanguage()` returns `{ lang, setLang, t }`
  when you also need the raw language code. Dictionary entries are either a
  plain string or `{ one, other }` for the one plural case this app has
  (item counts) — `params.count === 1` picks `one`.
- **Storage**: `ph_language` in `localStorage`, mirroring `theme.js`'s
  pattern. Defaults to browser-detected language (`navigator.language`) when
  nothing is stored yet, falling back to `nb` for anything unsupported.
  `LanguageProvider` is the **outermost** provider in `App.jsx` — every
  screen, including pre-auth ones, already has `useTranslation()`/
  `useLanguage()` available with no extra wiring.
- **Item names** (`src/lib/i18n/itemNames.js`): a display-only nb→en lookup
  for the ~710 `COMMON_ITEMS` entries, keyed by the lowercased canonical
  (Norwegian) name. **Never rewrite the stored name** — `item_catalogue.name`
  is the identity `checkCatalogueSync` upserts on, and the name icon-matching
  (`itemIcons.js`) and duplicate-detection both key off; translation only
  ever swaps the *displayed* string. A custom/free-typed item (most of a
  real household's list, over time) has no lookup entry and displays as
  typed either way — there's no translation API, by design.
- **Bidirectional catalogue matching**: `matchCatalogue(query, catalogue,
  lang)` (`shoppingUtils.js`) also matches a candidate's English translation
  when `lang === "en"`, so typing "milk" still finds "Melk" without ever
  renaming the stored row. Any new search/autocomplete surface over
  `item_catalogue` should follow the same pattern rather than inventing a
  new one.
- **Category names are the same kind of landmine, not yet fixed.**
  `CATEGORIES` (`shared/categories.js`, e.g. `"Frukt og grønt"`) is a literal
  data key — used by `clusterFor()`, `category_order`, and worker-side
  validation — not just display text. Don't translate the stored/validated
  value; Phase 7 below is where this actually gets solved (a stable-key
  layer, same shape as `CLUSTER_KEYS` already has).
- **`ConfirmContext.jsx`'s shared "Avbryt"** (the default Cancel button
  every `confirm()` dialog uses) is still hardcoded Norwegian — translating
  it once (Phase 6) fixes every confirm dialog across the whole app at once,
  including ones already otherwise translated (phase 1/2's shopping-list
  confirms currently show a translated title/body but a Norwegian Cancel
  button).
- **Server-side error strings are out of scope indefinitely**, not just
  deferred to a later phase here. `worker/index.js` returns Norwegian
  strings directly in `error` fields (e.g. `"Feil e-post eller passord"`),
  consumed via `toast(res.error)`. Solving this needs an error-code
  redesign of the API contract, not just more `t()` calls — a real
  follow-up scope decision, not a mechanical extraction. Each call site
  that surfaces `res.error` directly has a `// TODO(i18n)` comment; leave
  those as-is.

## How to extract a component (the established pattern)

1. Add `const t = useTranslation();` (import from
   `src/context/LanguageContext.jsx`); add `const { lang } = useLanguage();`
   too if the component renders an item/catalogue name (needs
   `translateItemName`).
2. Replace each literal Norwegian string/JSX text with `t("namespace.key")`,
   using `{param}` interpolation for anything with a variable
   (`t("key", { name, qty })`). Reuse one `namespace` per component/feature
   area (see the suggested namespaces per phase below).
3. Add the same keys to **both** `src/lib/i18n/dictionaries/nb.js` and
   `en.js` — nb first (copy the existing literal), then a natural English
   translation.
4. Where a `title`/`aria-label` pair repeats the same computed string,
   compute it once into a local `const` and reuse it (established in
   `ShoppingListTab.jsx`/`ItemCard.jsx`).
5. Don't touch anything that's a **data key**, not display text — category
   strings, `clusterKey` props passed to `clusterFor()`, catalogue
   `category` values sent to the API. Only JSX text/attributes that a user
   *reads* get translated.
6. `npm test` + `npm run build` before committing. New pure-logic
   dictionary/lookup additions don't need new tests by themselves (covered
   by existing `translate.test.js`/`itemNames.test.js`), but touch
   `shoppingUtils.test.js`-style tests if you add a new lookup helper.
7. Bump `VERSION` (MINOR — new user-facing capability) + a `CHANGELOG.md`
   entry, same as phases 1/2. Update this file's checkboxes, add a
   `Todo_done.md` entry under `(15)`, and trim `TODO.md` #15's remaining
   scope to match.
8. Manual click-through on the deploy preview (auth-gated UI, no local
   backend in-session) — switch to English, confirm the component's strings
   update instantly, switch back to nb, confirm nothing else regressed.

## Phase 3 — Meal planning (`MealsTab` + `src/components/meals/`)

Rough string counts (hardcoded-literal grep, not exact): `MealsTab.jsx`
(~15), `MealPlanModal.jsx` (~12), `MealEditModal.jsx` (~11),
`WeekIngredientsModal.jsx` (~6), `MealCatalogueBrowseModal.jsx` (~3),
`IngredientPickerModal.jsx`/`TokenInput.jsx` (~2 each), `IngredientChecklist.jsx`
(0 own literals — check for parent-supplied text).

Suggested namespace: `meals.*`.

Landmine: meal ingredients (`meal_catalogue.ingredients`, a plain JSON array
of free-text strings) are **not** tied to `item_catalogue` at all — none of
`itemNames.js`'s coverage carries over. An ingredient token that happens to
match a `COMMON_ITEMS` name could reuse `translateItemName` best-effort, but
most ingredient text (meal names especially) has no translation source —
same "translate what we can, pass through the rest" shape as item names, but
starting from zero infrastructure.

- [ ] `MealsTab.jsx`
- [ ] `MealPlanModal.jsx`
- [ ] `MealEditModal.jsx`
- [ ] `WeekIngredientsModal.jsx`
- [ ] `MealCatalogueBrowseModal.jsx`
- [ ] `IngredientPickerModal.jsx`
- [ ] `TokenInput.jsx`
- [ ] `IngredientChecklist.jsx`

## Phase 4 — Settings subpages

Rough counts: `AdminSubpage.jsx` (~25), `KontoSubpage.jsx` (~22),
`SettingsRoot.jsx` (~19 — the nav row labels, e.g. "Utseende"/"Konto"/
"Varsler"; these are duplicated in `AppShell.jsx`'s
`SETTINGS_SUBPAGE_TITLES` map, which must stay in sync), `VarslerSubpage.jsx`
(~12), `UtseendeSubpage.jsx`/`ButikkSubpage.jsx`/`MembersIsland.jsx` (~10
each), `RecurringIsland.jsx` (~6), `MetricsSettings.jsx`/
`InstallHelpModal.jsx` (~5 each), `PwaInstallCTA.jsx` (~3), `HjemSubpage.jsx`/
`AboutFooter.jsx` (~1 each), `StatistikkSubpage.jsx` (0 own literals).

Suggested namespace: `settings.*`, one sub-namespace per subpage (e.g.
`settings.konto.*`, `settings.admin.*`) — `SettingsRoot.jsx`'s nav labels can
share a `settings.nav.*` namespace with `AppShell.jsx`'s
`SETTINGS_SUBPAGE_TITLES` (both need the same string; consider a single
lookup object built from the dictionary instead of hardcoding the map twice).

- [ ] `SettingsRoot.jsx` (+ keep `AppShell.jsx`'s `SETTINGS_SUBPAGE_TITLES` in sync)
- [ ] `UtseendeSubpage.jsx`
- [ ] `KontoSubpage.jsx`
- [ ] `VarslerSubpage.jsx`
- [ ] `HjemSubpage.jsx`
- [ ] `ButikkSubpage.jsx` (category *names* stay untranslated until Phase 7 — just this subpage's own chrome)
- [ ] `AdminSubpage.jsx`
- [ ] `StatistikkSubpage.jsx`
- [ ] `MembersIsland.jsx`
- [ ] `RecurringIsland.jsx`
- [ ] `MetricsSettings.jsx`
- [ ] `InstallHelpModal.jsx`
- [ ] `PwaInstallCTA.jsx`
- [ ] `AboutFooter.jsx`

## Phase 5 — Auth screens

Rough counts: `LoginScreen.jsx` (~11), `SignupScreen.jsx` (~10),
`ResetPasswordScreen.jsx` (~6), `ForgotPasswordScreen.jsx` (~5),
`CredentialsModal.jsx` (~2), `GoogleSignIn.jsx` (~1), `AuthScreens.jsx`/
`Turnstile.jsx` (0 own literals — pure composition/widget wrapper).

These render **before** login, but `LanguageProvider` wraps the whole app
above `AuthProvider`, so `useTranslation()` is already available here with
no special wiring — this phase is pure extraction, no new plumbing. Note:
these screens have no way to *change* language yet (the switcher lives in
Settings, behind auth) — worth deciding whether a pre-auth language toggle
is wanted, or whether relying on auto-detected browser language is enough
for a not-yet-logged-in visitor. Not decided; ask before assuming.

- [ ] `LoginScreen.jsx`
- [ ] `SignupScreen.jsx`
- [ ] `ForgotPasswordScreen.jsx`
- [ ] `ResetPasswordScreen.jsx`
- [ ] `CredentialsModal.jsx`
- [ ] `GoogleSignIn.jsx`

## Phase 6 — Shared/global chrome

`ConfirmContext.jsx`'s default "Avbryt" — **one fix here benefits every
confirm dialog app-wide**, including the shopping-list ones from phases
1/2 that currently show a translated title/body next to a Norwegian Cancel
button. Also: `ImportantInfoModal.jsx` (~9), `FeedbackModal.jsx` (~5),
`InstallBanner.jsx` (~2), `ChangelogModal.jsx` (~2 — the modal's own chrome
only; it renders `CHANGELOG.md`'s content directly, which stays
Norwegian-only, out of scope). `Modal.jsx` itself has no own literals (pure
wrapper).

Suggested namespace: `common.*`.

- [ ] `ConfirmContext.jsx` (default Cancel button)
- [ ] `ImportantInfoModal.jsx`
- [ ] `FeedbackModal.jsx`
- [ ] `InstallBanner.jsx`
- [ ] `ChangelogModal.jsx` (chrome only, not the rendered changelog content)

## Phase 7 — Category display-label translation

Not a mechanical string-extraction phase — this is the "fix the landmine"
work flagged in Decisions above. `CLUSTER_KEYS`
(`src/lib/categoryClusters.js`) already has a stable, language-neutral id
per category (`"produce"`, `"dairy"`, …) that was invented for CSS token
lookup, not translation — reuse it as the stable key for a new
`src/lib/i18n/categoryNames.js`, same shape as `itemNames.js`:
`translateCategoryName(category, lang)` mapping the canonical Norwegian
`CATEGORIES` string → its `CLUSTER_KEYS` id → an `{nb, en}` label, display
only. `normalizeCategoryOrder`/`category_order`/worker validation keep
operating on the canonical `CATEGORIES` strings, unchanged.

Affects: `ButikkSubpage.jsx`'s reorder editor (label only — drag/reorder
logic still keys off the canonical array) and `ItemEditModal.jsx`'s
category `<select>` (`<option value={canonical}>{translatedLabel}</option>`).

- [ ] `src/lib/i18n/categoryNames.js` (+ test)
- [ ] `ButikkSubpage.jsx` reorder list labels
- [ ] `ItemEditModal.jsx` category picker labels

## Phase 8 — Meal names/ingredients (open scope, lower priority)

`meal_catalogue.name` and `.ingredients` are pure free text with zero
relationship to `item_catalogue` — no pre-built translation source exists
or is easy to build (unlike the fixed `COMMON_ITEMS` list, meal names are
arbitrary per-household text). Revisit only if actually wanted; plausible
this stays untranslated indefinitely, same reasoning as custom shopping
items.

## Ongoing / not a phase

Server-side error strings (`worker/index.js`, surfaced via
`toast(res.error)`) — see Decisions above. Don't attempt without a separate
scope discussion on redesigning the API's error contract.
