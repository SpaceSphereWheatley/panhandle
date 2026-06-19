# Changelog

All notable changes to Panhandle are recorded here. The version is duplicated
in two places (there is no build step to inject it) and bumped together on each
release:

- `worker/index.js` → `const VERSION`
- `public/app.html` → `const APP_VERSION`

The Profile page reads `GET /api/version` and shows both the app (Pages) and API
(Worker) versions, so a deploy where only one half landed is visible at a glance.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
project uses simple `MAJOR.MINOR.PATCH` numbers.

## [1.0.18] — 2026-06-19

### Changed
- Meal names typed into the meal planner are now capitalised on save too, using
  the same `capitalizeName` helper as item names (1.0.17 covered items but not
  meals). A meal entered as "taco" is stored "Taco". Lookups stay
  case-insensitive, so existing meal names are unaffected.

## [1.0.17] — 2026-06-19

### Changed
- Item names are now always capitalised. New catalogue names are saved with a
  capital first letter on the server (`capitalizeName`, applied on add and on
  rename), and the frontend capitalises every place an item name is shown
  (list, grid, recent, the edit modal, suggestions, meal-ingredient picker and
  toasts) via a `cap()` helper — so even legacy lowercase rows never display
  uncapitalised. The rest of the name is left as typed, so proper nouns,
  acronyms and casing like "7 Up" are preserved.

## [1.0.16] — 2026-06-19

### Added
- Gluten-free shorthand: adding an item with a `GF`, `gf` or `glutenfri` marker
  in its name (e.g. "Pasta GF") now files it under the normal catalogue name
  ("Pasta") with a "Glutenfri" note instead of creating a separate "Pasta GF"
  catalogue entry. The note always reads "Glutenfri" regardless of how the
  marker was typed. The plain item and its gluten-free variant coexist as two
  distinct lines — the add-merge check is now notes-aware, so one no longer
  bumps the other's quantity. Handled authoritatively in the Worker, with the
  frontend mirroring it for catalogue matching, suggestions and toasts.

## [1.0.15] — 2026-06-19

### Changed
- Shopping list: the "N varer igjen" count now shares a row with the list/grid
  view-toggle buttons (count on the left, toggle on the right) instead of
  sitting on its own line below them.

## [1.0.14] — 2026-06-19

Completes Phase 4 / the UX improvement plan. (T15, multiple meals per day, was
intentionally skipped — keeping one meal per day; it would have needed a schema
migration.)

### Added
- T21: Dark mode, with a Lys / Mørk / Følg systemet control in the Profile
  (defaults to following the OS). The theme is applied before the stylesheet to
  avoid a flash, and the PWA status-bar colour tracks the effective theme. The
  dark palette keeps the greens (which carry white text on any background) and
  flips only the neutral surfaces/text; `--accent-text` was decoupled from
  `--accent` so accent-coloured text stays readable on dark surfaces.

## [1.0.13] — 2026-06-19

Phase 4 (partial) of the UX improvement plan (`docs/ux-improvement-plan.md`):
look & feel. (T21, dark mode, is deferred — the palette has variables doing
double duty as both background and text, so it needs careful per-usage
decoupling and visual QA rather than a blind variable swap.)

### Changed
- T19: Darkened `--muted` (#8B7D6E → #6E6253) so secondary labels and the
  struck-through "bought" text meet AA contrast.
- T22: The Profile now shows a plain version number; the app-vs-API mismatch
  detail (deploy debugging) moved to the Admin subpage.

## [1.0.12] — 2026-06-19

Phase 3 (partial) of the UX improvement plan (`docs/ux-improvement-plan.md`):
recent-list and meal-planner polish. (T15, multiple meals per day, is deferred —
it needs a schema migration.)

### Added
- T17: A "N varer igjen" summary above the shopping list (and "Alt er handlet 🎉"
  when nothing's left).

### Changed
- T13: "Nylig kjøpt" now starts collapsed (still toggleable, choice remembered)
  and renders at most the 30 most-recent bought items, so the history can't grow
  unbounded.
- T14: The meal planner can now look up to 4 weeks ahead (still 1 week back) for
  planning further out.
- T18: The add-item field now hints the quantity shorthand in its placeholder
  ("Legg til vare – f.eks. «2 melk»").

## [1.0.11] — 2026-06-19

Phase 2 of the UX improvement plan (`docs/ux-improvement-plan.md`): the core
meal → shopping list connection — the app's headline promise, finally wired up.

### Added
- T1: From the meal modal, a "+ Legg ingredienser på handlelisten" button opens
  a picker of the meal's ingredients. The user chooses which to add; ingredients
  already on the active list are shown but left unchecked, the rest are
  pre-checked. Selected items are added (resolved to their catalogue name +
  category) and a toast confirms how many landed. The meal is saved first so its
  ingredients are remembered.
- T16: A note in the meal modal clarifies that ingredients are stored per meal
  name and shared across every date that meal appears on.

## [1.0.10] — 2026-06-19

Phase 1 of the UX improvement plan (`docs/ux-improvement-plan.md`): shopping
list reliability. Added a toast/snackbar mechanism and split list fetching from
rendering (`loadList` → `renderList`) so updates can apply instantly.

### Added
- T2: Optimistic UI — checking off and deleting items update the screen
  immediately and reconcile with the server in the background (with revert on
  failure). View/sort/collapse changes now re-render from cache without a
  round-trip.
- T4: Undo on delete — items are removed instantly with a 5-second "Angre"
  toast; the server delete only commits after the grace window, and polling
  can't resurrect a row mid-undo.
- T5: Adding an item that's already on the list now shows a toast explaining
  the quantity was increased (the API already merged it).
- T3: Failed adds/toggles/deletes now surface a toast and keep the typed text,
  instead of silently appearing to succeed.

### Changed
- T6: An expired/invalidated session now explains itself on the login screen
  ("Økten utløp …") instead of silently bouncing to login.

### Fixed
- Tapping the icon inside a card's edit/delete button no longer also toggles
  the item's bought-state (`closest()` guard).

## [1.0.9] — 2026-06-19

Phase 0 of the UX improvement plan (`docs/ux-improvement-plan.md`): quick,
low-risk frontend wins.

### Added
- T9: Show/hide password toggle on the login screen and both change-password
  fields.
- T8: Login button now shows a "Logger inn..." state and is disabled while the
  request is in flight, preventing double-submit.
- T20: `aria-label`s on icon-only buttons (add, list/grid view toggle, card
  edit/delete, install-banner dismiss).

### Changed
- T12: Re-enabled pinch-to-zoom (removed `maximum-scale=1.0, user-scalable=no`
  from the viewport meta) for accessibility.
- T7: Pressing Enter in the username or password field now submits the login.
- T11: Clarified the "Slett vare fra katalog" confirmation — it removes the
  item from this list's saved items (no longer suggested) and only affects this
  list. Also corrected a stale code comment that claimed the delete was global.

## [1.0.8] — 2026-06-19

### Fixed
- TODO #2: Polling (`/list`/`/plan`, every 7s) kept running while the tab
  was backgrounded, and `showApp()` never cleared a prior interval before
  starting a new one, risking stacked timers. The poll tick now skips work
  when `document.hidden`, `showApp()` clears any existing timer first, and
  a `visibilitychange` listener triggers an immediate refresh on returning
  to the tab so data isn't stale.

## [1.0.7] — 2026-06-19

### Fixed
- Long-press to open the item modal in grid view didn't work on touch
  devices: the timer was canceled on any `pointermove`, and touch input
  always reports a few pixels of jitter even when held still. Grid view
  now tolerates movement up to a 10px threshold before canceling, matching
  list view's existing behavior.

## [1.0.6] — 2026-06-19

### Added
- TODO #6: Item modal now allows renaming the catalogue entry itself
  (`PATCH /list/:id` accepts `name`) and deleting it from the catalogue
  entirely (new `DELETE /list/:id/catalogue`, cascades to every
  `list_items` row referencing it).
- TODO #7: Autocomplete suggestions now include an explicit "Legg til
  «...» nøyaktig som skrevet" option that adds the raw input as-is,
  bypassing catalogue matching and quantity parsing entirely.

### Fixed
- TODO #5: Autocomplete suggestions dropdown is now dismissed on any
  click outside the add bar, instead of lingering over other UI.
- TODO #7: `parseItemInput` no longer treats a *trailing* number as a
  quantity (e.g. "milk 2" no longer gets split into "milk" x2) — only the
  unambiguous leading "<qty> <name>" form is parsed that way.

## [1.0.5] — 2026-06-18

### Added
- TODO #9: Meal plan now has an "Ingredienser" field (comma-separated) in
  the meal-edit modal, stored as a JSON array on
  `meal_catalogue.ingredients` and shared across every occurrence of that
  meal name. Picking a known meal name auto-fills its stored ingredients.

### Fixed
- TODO #18: `parseItemInput` no longer strips a leading/trailing number
  from text that's an exact match for an existing catalogue item, so a
  product name containing a number isn't mis-split into name+quantity.
- TODO #19: New shopping-list items are stored as typed instead of being
  force-uppercased, matching the Title Case of the seeded catalogue.
- TODO #24: Removed the Worker's inline, stale copy of the seed-account
  form; `/seed.html` now serves only from `public/seed.html` via the
  existing Pages proxy.

## [1.0.4] — 2026-06-18

### Fixed
- TODO #14: Login rate-limiting — `/login` now tracks failed attempts per
  source IP in a new `login_attempts` D1 table (migration
  `0007_login_attempts.sql`) and returns 429 after 10 failures in a
  15-minute sliding window. Keyed by IP rather than username so flooding a
  known account's login can't lock out its real owner. Requires running
  `npx wrangler d1 migrations apply panhandle --remote` before this lands.
- TODO #16: `--green` / `--danger` CSS variables were referenced by the
  change-password button/messages but never defined in `:root`, so the
  button had no background and messages had no colour. Both vars are now
  defined.

## [1.0.3] — 2026-06-18

### Changed
- Profile page: moved "Varer i katalog" and "Måltider i database" into the
  admin-only Administrasjon subpage (they're internal/operational figures,
  not relevant to regular members). Removed the hardcoded "Synkronisering:
  Hvert 7. sekund" row — it was a non-actionable, easily-stale label for an
  internal implementation detail (the poll interval).

## [1.0.2] — 2026-06-18

### Changed
- Meal plan no longer keeps long-term history: week navigation is clamped to
  last week / this week / next week (`weekOffset` in `[-1, 1]`, with the
  "Forrige"/"Neste" buttons disabling at the edges), and `GET /plan`
  opportunistically deletes `meal_plan` rows older than 14 days on every
  read. `meal_catalogue` (the reusable meal names) is untouched.

## [1.0.1] — 2026-06-18

### Fixed
- Meal-plan date off-by-one: the week grid, "today", and the saved
  `plan_date` were formatted with `Date#toISOString()`, which converts to UTC
  first — between local midnight and the UTC offset (00:00–02:00 in
  UTC+1/+2) the whole week view, "today", and what got saved all silently
  shifted back a day. Now formatted from local date components instead.

## [1.0.0] — 2026-06-18

First tagged version. Establishes versioning for the already-live app; captures
the feature set shipped to date.

### Added
- Shared shopping list with a catalogue-backed autocomplete, per-category
  grouping, quantity + notes, list and grid views, swipe-to-buy, and an item
  detail modal.
- Meal planner with a Monday–Sunday week view, any-week navigation, and an
  assigned-responsible person per day.
- Accounts and auth: PBKDF2 password hashing, hand-rolled HS256 JWTs with
  token versioning, sliding expiry on every authenticated response, and an
  in-app password change that logs out other devices.
- Multi-tenant model (`0005_multi_tenant.sql`): per-list data isolation with
  independent `is_admin` / `is_owner` flags, admin-created owner lists, and
  owner-managed members.
- Catalogue seeds: `0004_seed_catalogue.sql` (~506 Norwegian items) and
  `0006_expand_catalogue.sql` (+200, ~706 total), both non-destructive upserts.
- PWA install prompt, emoji/SVG item icons, and a one-time credential/invite
  dialog for newly created accounts.
- `GET /api/version` endpoint and a Profile-page version readout.

[1.0.0]: https://github.com/SpaceSphereWheatley/panhandle/releases/tag/v1.0.0
