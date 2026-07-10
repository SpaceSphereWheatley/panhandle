# Changelog

All notable changes to Panhandle are recorded here. The version is duplicated
and bumped together on each release:

- `worker/index.js` → `const VERSION`
- `src/lib/version.js` → `APP_VERSION` (the live frontend, as of 1.10.0 — see below)

`public/app.html`'s own `APP_VERSION` constant is no longer live (superseded by
the React app built from `src/`) but is left in place for now; it isn't served
by Cloudflare Pages anymore, so it's not part of the bump going forward.

The Profile page reads `GET /api/version` and shows both the app (Pages) and API
(Worker) versions, so a deploy where only one half landed is visible at a glance.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
project uses simple `MAJOR.MINOR.PATCH` numbers (see CLAUDE.md's Versioning
section for the bump convention).

## [1.11.0] — 2026-07-10

### Changed
- **New visual design**, built from the "Panhandle Design System" Claude
  Design project: warm-paper/terracotta/sage palette, Instrument Sans +
  Caveat type, Phosphor icons, and generously-rounded pill-shaped
  components. The design system's tokens and component library
  (Button, Card, ListItem, Header, TabBar, Sheet, Input, Checkbox, Switch,
  Tag, Avatar, Badge, IconButton) are imported into the repo under
  `src/design-system/` and used to rebuild the shopping list, meal plan,
  navigation, login screen, and modals. A dark-mode palette (not part of
  the source design, which is light-only) was authored to extend the
  app's existing light/dark/system theme toggle. New PWA icons and
  manifest colors adopt the same brand. The hand-drawn per-grocery-item
  icon set and the flat nav icon set's *mapping* stay — nav/chrome icons
  now render via Phosphor instead of bundled inline SVG. No functional
  changes: same features, same data, same API.

## [1.10.0] — 2026-07-10

### Changed
- **Frontend rewritten in React**, built with Vite. Replaces the hand-rolled
  vanilla JS/HTML single-file app (`public/app.html`) with a component-based
  app under `src/`, built to `dist/` and deployed by Cloudflare Pages via
  `npm run build`. All three tabs (Handleliste, Måltider, Innstillinger) are
  fully ported, plus the deploy-version-drift toast, PWA install prompt, and
  browser back-button navigation for tabs/settings. No user-facing behavior
  changes are intended — this is an internal rewrite of the same app.
- The hand-drawn item icon library and flat UI icon library
  (`itemIcons.js`/`uiIcons.js`) are now plain ES modules under `src/lib/`
  instead of scripts attached to `window`.

### Known gaps vs. the previous frontend
  Swipe-to-toggle and long-press-to-edit gestures, the per-card resolve
  animation, and back-button support *within* modals aren't ported yet —
  see the React port PRs (#76, #77) for details.

## [1.9.2] — 2026-07-07

### Fixed
- Item-marking animation: toggling one item while another item's mark-as-bought
  animation was still playing could interrupt the in-progress animation with a
  visual flicker (a full list re-render on the first toggle's completion would
  wipe the second item's in-flight animation state). The list is now aware of
  which items are still mid-animation and preserves that state across re-renders.

## [1.9.1] — 2026-07-07

### Fixed
- List view: item name text now lines up vertically with its icon/badge for
  items with no quantity or notes (the common case) — a reserved-but-empty
  notes line was pushing the name text above the badge's center.

## [1.9.0] — 2026-07-06

### Added
- **Fast ukentlig ansvar**: set a default responsible person per day of the week
  (Settings → "Fast ukentlig ansvar"). The default is shown in muted italics on
  unplanned days in the meal plan, and pre-fills the responsible dropdown when
  adding a new meal. It's always overridable for any individual day.
- **Annet** option in the responsible dropdown (meal modal): select "Annet..."
  to type a custom label such as "Ute og spiser" or "Gjester lager mat". If
  left blank, the value is saved as "Annet".

## [1.8.1] — 2026-06-22

### Added
- A brief shrink/fade animation on a shopping item when it's marked
  purchased or un-marked from "Nylig kjøpt", so toggling no longer just
  teleports the row from one place to another.

## [1.8.0] — 2026-06-20

### Added
- A "Vibrasjon ved handling" toggle in Profil settings to turn haptic feedback
  on/off (default on); short vibration on checking off, adding, or deleting an
  item.

### Fixed
- Swiping down at the top of a list no longer triggers the browser's native
  pull-to-refresh (full page reload) — content scrolling now contains the
  overscroll instead of bubbling up to the page.
- The header, bottom tab bar, floating add button, and toast now respect the
  device's notch/gesture-bar safe areas instead of running underneath them.
- Added iOS web-app meta tags (`apple-mobile-web-app-capable` etc.) for a
  cleaner standalone/install experience on iOS.

## [1.7.0] — 2026-06-20

### Added
- Auto-refresh prompt for app updates: while a tab stays open, it now polls
  the live Worker version every 60s (and right when the tab regains focus)
  and shows a toast with an "Oppdater" button the moment a new deploy lands,
  instead of only detecting it on the next fresh page load. Never reloads on
  its own, so an in-progress edit isn't lost.

## [1.6.2] — 2026-06-20

### Fixed
- The dropdown arrow on the meal-planning "Måltid" field didn't open anything
  when clicked (an `<input list>` datalist's native arrow indicator is
  unreliable across browsers). Replaced it with a custom dropdown that
  reliably opens on click or focus and filters as you type.

## [1.6.1] — 2026-06-20

### Added
- Free-form labels on meals (e.g. "Middag", "Vegetar") — add them in the meal
  editor with autocomplete from labels already used in the catalogue, shown as
  chips in "Alle måltider", and filterable there via a label dropdown.

## [1.6.0] — 2026-06-20

### Added
- Purchase-frequency tracking on `item_catalogue` (`times_bought`,
  `first_bought`, `last_bought`, bumped on the toggle-to-bought transition) and
  a `GET /catalogue/suggestions` endpoint that recommends items you're
  probably out of, ranked by how overdue they are against their own average
  purchase interval. Surfaced via a badge on the shopping tab's FAB — tapping
  it opens a "Sannsynligvis tom for" sheet to add suggested items with one tap,
  falling back to the regular add-input shortcut when there's nothing to
  suggest.

## [1.5.0] — 2026-06-20

### Added
- A "what's new" toast the first time a device opens the app after a new
  version has been deployed, with a button that opens a changelog modal
  showing this file's contents. Also reachable any time from Innstillinger →
  Om → "Hva er nytt?". The changelog is now also copied to
  `public/CHANGELOG.md` so Cloudflare Pages can serve it as a static asset
  for the frontend to fetch.

## [1.4.2] — 2026-06-20

### Removed
- The "Sorter liste" pill on the Handleliste tab — it toggled an alphabetical
  sort within each category, but the toggle's visual state and effect were
  unreliable enough that it read as broken. Removed the button along with
  `sortMode`/`toggleSort` and the now-dead `.pill` CSS; the list always
  renders in default category order.

## [1.4.1] — 2026-06-20

### Fixed
- The Android/browser back button did nothing sensible inside the app (no
  `history` integration existed at all) — pressing it while a modal was open,
  mid-drill-down in Innstillinger, or on the Måltider/Innstillinger tab just
  exited the standalone PWA instead of stepping back one level. Tab switches,
  settings drill-down (main ↔ profile/medlemmer/administrasjon/om), and every
  modal now push a `history` entry, so back closes the modal / returns to the
  previous subpage or tab first, matching what a user expects. Escape now also
  closes an open modal.

## [1.4.0] — 2026-06-20

### Changed
- Renamed the "Profil" tab to "Innstillinger" (Settings) and restructured it
  into a category list — Profil, Medlemmer (owner-only), Administrasjon
  (admin-only), and Om — each its own drill-down subpage instead of one long
  scrolling page. No functionality changed, only how it's organized: account
  info/theme/password/logout live under Profil, list-member management moved
  from an inline panel to its own Medlemmer subpage, and the version number
  moved to a new Om subpage.

## [1.3.0] — 2026-06-20

### Added
- The Måltider tab's FAB now opens a small chooser ("Nytt måltid" / "Rediger
  måltider") instead of going straight to the new-meal editor — editing an
  existing meal is just as common a reason to tap it.
- The new-meal/edit-meal modal now flags name collisions as you type: an
  exact (case-insensitive) match against another meal shows an error and
  blocks saving early (mirroring the server's own duplicate check), and a
  substring match against another meal's name shows a "Ligner på: …" hint
  so near-duplicates are caught before they're saved.
- A FAB on the Handleliste tab — for now it just jumps focus to the add bar;
  a fuller quick-add flow may follow.

## [1.2.1] — 2026-06-20

### Changed
- "+ Nytt måltid" moved off the Måltider tab's header (where it was a small,
  easy-to-miss text link) onto a floating action button anchored bottom-right
  of the tab, above the nav bar — matching the prominence a primary "add" action
  warrants. The header now only has the "Alle måltider ›" link; its own
  "+ Nytt måltid" button (inside that browse modal) is unchanged.

## [1.2.0] — 2026-06-19

### Added
- A meal editor: "+ Nytt måltid" (header of the Måltider tab, and inside
  "Alle måltider") adds a meal to `meal_catalogue` with its ingredients
  without assigning it to a day. Clicking any row in "Alle måltider" opens
  the same editor to rename a meal, edit its ingredients, or delete it from
  the catalogue entirely (`POST /api/meals`, `PATCH /api/meals/:id`,
  `DELETE /api/meals/:id`) — previously meals could only be created/edited
  implicitly by planning a day.

## [1.1.0] — 2026-06-19

### Added
- Meal suggestions: `meal_catalogue` now tracks `times_planned`/`last_planned`
  per meal (migration `0004_meal_usage_stats.sql`), and the meal-planning
  modal shows quick-pick chips (`GET /api/meals/suggestions`) for meals eaten
  often but not in the last 10 days.
- "Alle måltider" — a read-only, filterable browse view of every saved meal
  with its usage stats, opened from the Måltider tab.

## [1.0.19] — 2026-06-19

### Added
- A manual "Installer app" row on the Profile page that works even when the
  browser's `beforeinstallprompt` event never fires (it only fires under
  browser-specific heuristics, and stops firing after repeated dismissals or
  an uninstall — previously this left no way to install). Shows an install
  button when the browser-native prompt is available, otherwise shows
  platform-specific manual instructions (iOS Safari vs. other browsers).
  Placed next to the theme toggle so account info, preferences, owner/admin
  actions, security and logout stay in clean logical groups.

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
