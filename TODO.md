# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed, just strike them and move to Done; re-pack (renumber) only
when the open list gets sparse, as just happened here. Full "fixed in"
details live in `CHANGELOG.md`, not here.

1. No service worker despite the PWA manifest — the app is installable but
   has zero offline capability. Add a minimal app-shell service worker, or
   drop the offline expectation.
   _Value: Medium · Importance: Medium · Type: Feature (PWA)_
2. Polling runs every 7s regardless of `document.hidden`, and a second
   `showApp()` could stack timers. Guard the interval on visibility and
   clear before re-arming.
   _Value: Medium · Importance: Low · Type: Performance_
3. `viewport` sets `maximum-scale=1.0, user-scalable=no`, disabling
   pinch-zoom — an accessibility regression.
   _Value: Medium · Importance: Low · Type: Accessibility_
4. CI pins `trufflesecurity/trufflehog@main` (a moving ref) — pin to a
   release tag or commit SHA.
   _Value: Medium · Importance: Low · Type: CI / supply chain_
8. Grid view on mobile has no way to open the item modal — dragging and
   long-press gestures don't reliably work. Need a button, tap zone, or context
   menu to access item details and edit/delete from grid.
   _Value: Medium · Importance: High · Type: UX (mobile)_
9. When a user assigns a meal, there's no way to auto-populate the shopping
   list with that meal's ingredients. Currently ingredients are stored on
   `meal_catalogue.ingredients` but not exposed as a "add to list" action. Should
   be able to select which of a meal's ingredients to add when viewing a plan.
   _Value: Medium · Importance: Low · Type: Feature (workflow)_

## Done

- [x] Item detail modal: rename the catalogue entry itself, or delete it
      entirely (cascades to every list it appears on). (1.0.6)
- [x] Autocomplete: explicit "add exactly as typed" bypass option, plus
      `parseItemInput` no longer treats a trailing number as quantity
      (e.g. "milk 2" no longer hijacked into "milk" x2). (1.0.6)
- [x] Autocomplete dropdown now dismissed on outside click instead of
      lingering over other UI. (1.0.6)
- [x] Multi-owner lists, admin-created accounts, per-list isolation — see
      `docs/multi-tenant-plan.md`. Migration `0005_multi_tenant.sql`.
- [x] Login rate-limiting — `login_attempts` D1 table, 429 after 10 failures
      per IP in a 15-minute window. (1.0.4)
- [x] Meal-plan date off-by-one — local date components instead of
      `toISOString()`. (1.0.1)
- [x] Missing `--green`/`--danger` CSS variables. (1.0.4)
- [x] `parseItemInput` mis-parsing names containing numbers. (1.0.5)
- [x] New shopping-list items force-uppercased instead of stored as typed.
      (1.0.5)
- [x] Meal plan: surface `meal_catalogue.ingredients` in the UI. (1.0.5)
- [x] Worker's stale inline `/seed.html` copy, duplicating
      `public/seed.html`. (1.0.5)
- [x] Item detail modal: long-press the card or tap "⋮" to edit category,
      quantity, and notes (`PATCH /api/list/:id`).
- [x] Allow editing an item's category from the item modal.
- [x] Empty states for the shopping list ("Ingen varer på listen").
- [x] Basic offline/slow-network handling — `syncStatus` shows
      "Offline"/"Kunne ikke oppdatere" on failed polls, browser
      online/offline events trigger an immediate retry.
- [x] Meal plan UI: Monday–Sunday week view with prev/next/this-week nav.
- [x] Make layout mobile-first but consistent at desktop widths too — cap
      content width (e.g. `max-width: 480px`, centered) instead of a
      separate desktop layout.
- [x] Add a `notes` (free text — quantity, description, etc.) column to
      `list_items`. Migration `0003_list_items_qty_notes.sql`.
- [x] Quantity-aware "merge" when adding an item that's already on the
      list unbought (previously created duplicate rows against the same
      catalogue entry).
- [x] Grid view for the shopping list as an alternative to the list view
      (toggle between the two), 3-column, with a circular first-letter
      badge placeholder icon per item.
- [x] Swipe-to-mark-bought on shopping list cards (swipe left past a
      threshold), separate from the long-press-for-modal gesture.
- [x] PWA install prompt banner (native `beforeinstallprompt` on
      Chrome/Android, share-sheet instructions on iOS Safari), dismissible
      and remembered in `localStorage`.
- [x] Emoji icon set for common catalogue items (`public/itemIcons.js`).
- [x] Icon lookup by normalized item name, falling back to the
      first-letter badge in grid view when no icon is mapped.
- [x] Settings view listing catalogue items that don't have a matching
      icon yet, to help decide what to design next.
