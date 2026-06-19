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
