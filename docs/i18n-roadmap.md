# i18n roadmap (language support)

Tracks TODO #15 (language support) across sessions. **All phases are done as
of 1.47.0 — the app is fully translated, including server error messages.**
Phase 1 (infra + the Settings → "Språk" switcher + `ShoppingListTab`, 1.43.4),
phase 2 (the ~710 `COMMON_ITEMS` catalogue names, 1.44.0), phases 3-5 (meals,
settings + the app shell, auth screens, 1.45.0), phases 6-7 (shared chrome,
category display labels, 1.46.0) and the server error-code layer (1.47.0) have
all shipped. Phase 8 is closed as a deliberate won't-do (see below).

This file is now a record of the decisions rather than a plan. Read
"Decisions already made" before touching anything translation-related — the
rules there are what keep a translation from corrupting stored data.

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
- **`common.*` exists now** (added in phase 3): the button words that repeat
  in every modal — `common.cancel`/`common.save`/`common.close`. Phase 6 was
  originally going to introduce this namespace; reuse and extend it rather
  than inventing per-component copies. (`itemEdit.cancel`/`itemEdit.save`
  predate it and were left alone.)
- **Dates go through `src/lib/i18n/dateLocale.js`** (added in phase 3), not a
  hardcoded `"no-NO"`. `dateLocale(lang)` maps nb→`nb-NO`, en→`en-GB` (en-GB
  keeps day-before-month, so a language switch doesn't reflow date rows);
  `weekdayNames(lang)` returns the Monday-first, capitalized weekday list that
  `recurring_schedule.day_of_week` assumes. Unit-tested in `dateLocale.test.js`.
- **Never store a rendered sentence in state** — a language switch has to
  re-render it. Three places were converted to hold a code/structured value
  and call `t()` at render time instead: `AuthContext`'s `expiredReason` (now
  the code `"expired"`), `AppShell`'s `sync` (now `{ kind, at, offline }`),
  and `MealEditModal`'s `similarNote` (now `{ kind, names }`). Follow the same
  shape for any new state that would otherwise cache translated text.
- **`dictionaries.test.js` guards nb/en parity.** `translate()` silently falls
  back to nb for a key missing from en, so a gap shows up as a stray Norwegian
  string rather than a crash. The test fails on a missing key, a plural/plain
  mismatch, differing `{placeholders}`, or an empty value — it caught one real
  miss during phase 4. Run `npm test` after editing either dictionary.
- **Category names were a landmine; it's fixed now (phase 7).** `CATEGORIES`
  (`shared/categories.js`, e.g. `"Frukt og grønt"`) is a literal data key —
  used by `clusterFor()`, `category_order`, and worker-side validation — not
  just display text, so the stored/validated value is never translated.
  `translateCategoryName(category, lang)` (`src/lib/i18n/categoryNames.js`)
  maps it through `CLUSTER_KEYS` to a `category.<id>` dictionary entry, display
  only. **Any new surface showing a category name must use it**, and any
  `<option>` over `CATEGORIES` needs an explicit `value={canonical}` — without
  one an option's value falls back to its text content, which would POST the
  translated label as the category (this bit `ItemEditModal`).
- **Provider-level defaults resolve at render, not at call time** (phase 6).
  `ConfirmContext` stores `title`/`confirmLabel` as `null` when the caller
  omits them and falls back to `t("common.confirm.*")` in its JSX; `ToastContext`
  does the same for the undo button's label. Storing the translated default at
  call time would have frozen it, and resolving it inside `confirm` itself
  would have changed that callback's identity on every language switch — it
  sits in several components' dependency arrays.
- **Server error strings are translated via codes, not text matching** (see
  the section at the end). `worker/index.js` answers `{ error, code }`; the
  client resolves the code through `apiErrorMessage(res, t)` and never
  string-matches the message. Never surface `res.error` directly in new code —
  use the helper, so an unknown code still degrades to the server's wording
  instead of a raw key.

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

## Phase 3 — Meal planning (`MealsTab` + `src/components/meals/`) — DONE (1.45.0)

Namespace `meals.*`. Two things deliberately left canonical, not translated:
`MealPlanModal`'s `"Annet"` fallback (a *stored* `meal_plan.responsible`
value, read back by other devices) and `TokenInput`'s ingredient suggestions
(a committed token is persisted to `meal_catalogue.ingredients` and later
name-matched against `item_catalogue`). `IngredientChecklist` does translate
matched ingredient names best-effort via `translateItemName` — display only.

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

- [x] `MealsTab.jsx`
- [x] `MealPlanModal.jsx`
- [x] `MealEditModal.jsx`
- [x] `WeekIngredientsModal.jsx`
- [x] `MealCatalogueBrowseModal.jsx`
- [x] `IngredientPickerModal.jsx`
- [x] `TokenInput.jsx`
- [x] `IngredientChecklist.jsx`

## Phase 4 — Settings subpages — DONE (1.45.0)

Namespace `settings.*`. Two duplicated label sources were single-sourced
rather than kept in sync by hand: `SETTINGS_SUBPAGE_TITLE_KEYS`
(`src/lib/settingsNav.js`) replaced the map `AppShell` and `SettingsRoot` each
hardcoded, and `weekdayNames(lang)` replaced `mealUtils`'s `WEEKDAYS_NO`
(now deleted). `AppShell`'s own chrome (tab-bar labels, header titles, sync
status — namespace `shell.*`) was translated in the same pass: it was outside
the original checklist, but leaving the tab bar Norwegian under translated
subpage titles would have been the most visible untranslated text in the app.
Category *names* in `ButikkSubpage` are still canonical — that's phase 7.

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

- [x] `SettingsRoot.jsx` (+ `AppShell.jsx` — now both read `SETTINGS_SUBPAGE_TITLE_KEYS`)
- [x] `UtseendeSubpage.jsx`
- [x] `KontoSubpage.jsx`
- [x] `VarslerSubpage.jsx`
- [x] `HjemSubpage.jsx` (no own literals — its content is Members/Recurring below)
- [x] `ButikkSubpage.jsx` (category *names* stay untranslated until Phase 7 — just this subpage's own chrome)
- [x] `AdminSubpage.jsx`
- [x] `StatistikkSubpage.jsx` (no own literals — wraps `MetricsSettings`)
- [x] `MembersIsland.jsx`
- [x] `RecurringIsland.jsx`
- [x] `MetricsSettings.jsx`
- [x] `InstallHelpModal.jsx`
- [x] `PwaInstallCTA.jsx`
- [x] `AboutFooter.jsx`
- [x] `SprakSubpage.jsx` (missed by the original list — its own chrome; the two
      language options stay each language's endonym)
- [x] `AppShell.jsx` (`shell.*` — tab bar, header titles, sync status)

## Phase 5 — Auth screens — DONE (1.45.0)

Namespace `auth.*`. **The open question was decided: no pre-auth switcher.**
The auth screens follow the stored `ph_language`, or the browser's language on
a first visit — one less control on the login screen, and a returning user's
choice already applies. `GoogleSignIn` passes `locale: lang` to
`renderButton` so Google's own button text matches (read through a ref, so a
language change can't tear down and refetch the GIS script).

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

- [x] `LoginScreen.jsx`
- [x] `SignupScreen.jsx`
- [x] `ForgotPasswordScreen.jsx`
- [x] `ResetPasswordScreen.jsx`
- [x] `CredentialsModal.jsx` (the copied invite text follows the *inviter's*
      language — they compose and send it, and the invitee has no stored
      preference yet)
- [x] `GoogleSignIn.jsx` (no own literals; passes `locale` to Google's widget)
- [x] `AuthContext.jsx` (`expiredReason` is now a code, rendered by `LoginScreen`)

## Phase 6 — Shared/global chrome — DONE (1.46.0)

Namespace `common.*` (plus small per-component namespaces). `ConfirmContext`'s
default Cancel button was the headline fix — one change, every confirm dialog
app-wide, including phase 1-5 ones that showed a translated title next to a
Norwegian "Avbryt".

The checklist below was incomplete. A sweep for Norwegian literals turned up
four more files with user-facing text, all genuinely shared chrome, so they're
included:

- [x] `ConfirmContext.jsx` (default Cancel button + default title/confirm label)
- [x] `ImportantInfoModal.jsx` (its demo item names now display translated too,
      while `ItemIcon` still receives the canonical name for icon matching)
- [x] `FeedbackModal.jsx`
- [x] `InstallBanner.jsx`
- [x] `ChangelogModal.jsx` (chrome only — the rendered `CHANGELOG.md` content
      stays Norwegian, as planned; its error message is now a flag, not a
      stored sentence)
- [x] `ToastContext.jsx` — the default "Angre" undo label (not on the original
      list)
- [x] `useDeployVersionCheck.js` — the two post-deploy toasts and their action
      labels; takes `t` as a param and reads it through a ref, since its effect
      is deliberately mount-only (not on the original list)
- [x] `PushContext.jsx` — four client-generated subscribe errors surfaced via
      `toast` (not on the original list; these are *client* strings, unlike the
      server errors that stay out of scope)
- [x] `CategoryOrderContext.jsx` / `RecurringContext.jsx` — each had a
      client-side "Kunne ikke lagre" network-failure string (not on the
      original list)

## Phase 7 — Category display-label translation — DONE (1.46.0)

`src/lib/i18n/categoryNames.js` exposes `translateCategoryName(category, lang)`,
mapping the canonical Norwegian `CATEGORIES` string → its `CLUSTER_KEYS` id →
a `category.<id>` dictionary entry. `CLUSTER_KEYS` is now exported from
`categoryClusters.js` for this. `normalizeCategoryOrder`/`category_order`/the
Worker's validation all still operate on the canonical strings, unchanged —
and `clusterFor()` still keys off them for colour.

Keying the dictionary on the cluster id rather than the Norwegian text means
the entries don't embed a Norwegian sentence in their key, and renaming a
Norwegian label later wouldn't orphan them. An unknown category passes through
untranslated, same as `translateItemName` does for custom items.

`categoryNames.test.js` asserts every `CATEGORIES` entry resolves in both
languages (a missing one would render a raw `category.xyz` key) and that the
nb label round-trips to exactly the canonical string.

- [x] `src/lib/i18n/categoryNames.js` (+ test)
- [x] `ButikkSubpage.jsx` reorder list labels (drag/reorder still keys off the
      canonical array; the move up/down aria-labels use the translated name)
- [x] `ItemEditModal.jsx` category picker labels (**with an explicit
      `value={c}`** — see Decisions)

Note: `ShoppingListTab` never displays a category name (it renders one flat,
aisle-sorted list and uses the category only for cluster colour), so it needed
no change.

## Phase 8 — Meal names/ingredients — CLOSED, won't do

`meal_catalogue.name` and `.ingredients` are arbitrary per-household free text
with **no translation source** — unlike the fixed `COMMON_ITEMS` list there is
nothing to look them up against, and this app deliberately has no translation
API (see Decisions). The only two things that could have been built:

1. A translation API call — ruled out by the app's own design.
2. Best-effort per-token translation of ingredients that happen to match a
   `COMMON_ITEMS` name. This is *already* done where it's safe and useful
   (`IngredientChecklist`, via `translateItemName`). Extending it to
   `TokenInput`'s chips was considered and rejected: a chip's text **is** the
   stored token, and translating a subset of a list produces a mixed
   Norwegian/English ingredient list that reads worse than a consistent one.

Meal names have no path at all. Closed — reopen only if a concrete need shows
up, and expect it to need a translation service, not more `t()` calls.

## Server error strings — DONE (1.47.0)

Was "out of scope indefinitely, needs an error-code redesign". It got done,
because measuring it changed the picture: **no test asserts on the error
text** (the integration suite checks `res.status` only), so the change could
be purely additive instead of a breaking contract redesign.

`shared/errorCodes.js` is the single source: 50 `CODE → canonical Norwegian
message` pairs. `worker/index.js` gained `err(code, status, { detail, extra })`
and its per-request `authedErr` counterpart (same `X-Refresh-Token` header as
`authedJson`); all 108 error returns go through one of them and answer with
`{ error, code }`. **`error` is still the same Norwegian string it always
was**, so any client reading only `error` — including a browser running a
bundle older than this deploy — is unaffected.

Client side: `src/lib/apiError.js`'s `apiErrorMessage(res, t)` prefers
`error.<CODE>` from the dictionary and falls back to the server's own `error`
string for an unknown or absent code, so a newer Worker talking to an older
bundle degrades to Norwegian rather than showing a raw key. The nb dictionary
**derives** its `error.*` entries from `shared/errorCodes.js` rather than
restating them, so the two can't drift; only `en.js` has hand-written
translations.

Guards (`tests/worker-unit.test.mjs`): every code used in the worker is
defined, every defined code is used, every code has a non-empty nb message and
an `error.<CODE>` entry in `en.js`, and **no `error: "..."` literal survives
outside the helpers** — a new uncoded error response fails the build. There's
also a vacuity guard asserting the source regex actually matches something, so
renaming the helper can't silently disable the rest.

`AuthContext` now hands the whole error body (`{ error, code }`) to the auth
screens instead of a pre-baked Norwegian fallback; `MetricsSettings` holds the
error *body* in state and resolves it at render, per the "never cache a
rendered sentence" rule above.

Adding an error: add the code + Norwegian message to `shared/errorCodes.js`,
add `error.<CODE>` to `en.js`, return it via `err`/`authedErr`. Never rename or
reuse a code — a deployed client may still be mapping the old one.
