# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed, just strike them and move to Done; re-pack (renumber) only
when the open list gets sparse, as just happened here. Full "fixed in"
details live in `CHANGELOG.md`, not here.

1. Grid view: a category with a single item leaves the other 1-2 cells in
   its row visibly empty (each `CatSection`'s grid in
   `src/tabs/ShoppingListTab.jsx` is its own 3-col grid, so a lone item
   doesn't reflow into the next category's row).
   Looks unfinished, especially with several single-item categories in a
   row. Either flow items into one continuous grid across category
   boundaries, or only show the category header inline without a hard grid
   break per group.
   _Value: Low · Importance: Low · Type: UX (visual polish)_
2. Poll interval is a fixed 7s with no backoff when the tab is idle (no
   interaction for a while) but visible. At 2 users on D1 this costs
   nothing today — only worth doing once user count or request volume
   actually grows, and it trades off responsiveness (stale data right
   after returning from idle) for load savings, so don't add it
   speculatively.
   _Value: Low · Importance: Low · Type: Performance_

## Done

- [x] CI pinned `trufflesecurity/trufflehog@main` (a moving ref) — pinned to
      the `v3.95.9` release commit SHA instead. (1.15.0)
- [x] No `Escape` key handler on any modal — a `keydown` listener on
      `Sheet.jsx` (shared by all modals via `Modal.jsx`) now calls `onClose`
      on Escape. (1.15.0)
- [x] `public/sw.js` was a network-passthrough stub with no caching, so the
      app had zero offline capability despite being installable — now does
      stale-while-revalidate app-shell caching (everything except `/api/*`
      and `/seed`, which always hit the network). (1.15.0)
- [x] `migrations/0004_seed_catalogue.sql` referenced the `lists` table and
      `list_id` column that didn't exist until `0005_multi_tenant.sql` ran
      after it — applying migrations in numbered order on a fresh D1
      instance failed outright at 0004. Fixed by squashing all of
      0001-0007 into one consolidated `migrations/0001_init.sql` (this
      project has exactly one deployment, so there's no cross-environment
      migration history to preserve); the two remaining files
      (`0002_seed_catalogue.sql`, `0003_expand_catalogue.sql`) are pure,
      order-independent data seeds that now correctly depend on schema
      that already exists from `0001_init.sql`.

- [x] Grid view long-press to open the item modal didn't work reliably on
      touch (jitter canceled the timer); also fixed via a button/tap-target
      affordance. (1.0.7)
- [x] Polling ran every 7s regardless of `document.hidden`, and a second
      `showApp()` could stack timers — interval now guarded on visibility
      and cleared before re-arming. (1.0.8)
- [x] `viewport` disabled pinch-zoom via `maximum-scale=1.0,
      user-scalable=no` — removed for accessibility (T12). (1.0.9)
- [x] Meal ingredients → shopping list: a "+ Legg ingredienser på
      handlelisten" button on the meal modal lets you pick which of a
      meal's stored ingredients to add (T1). (1.0.11)
- [x] Item detail modal: rename the catalogue entry itself, or delete it
      entirely (cascades to every list it appears on). (1.0.6)
- [x] Autocomplete: explicit "add exactly as typed" bypass option, plus
      `parseItemInput` no longer treats a trailing number as quantity
      (e.g. "milk 2" no longer hijacked into "milk" x2). (1.0.6)
- [x] Autocomplete dropdown now dismissed on outside click instead of
      lingering over other UI. (1.0.6)
- [x] Multi-owner lists, admin-created accounts, per-list isolation — see
      `docs/multi-tenant-plan.md`. Originally migration `0005_multi_tenant.sql`,
      now folded into the consolidated `migrations/0001_init.sql`.
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
      `list_items`. Originally migration `0003_list_items_qty_notes.sql`,
      now folded into the consolidated `migrations/0001_init.sql`.
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
