# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed or reordered, just strike them from this list and let the
rest keep their numbers (re-pack the list only if it gets sparse).

9. Meal plan: surface `meal_catalogue.ingredients` somewhere in the UI —
   it's stored but currently unused/unedited by the frontend.
13. Multi-owner lists, admin-created accounts, per-list isolation —
    see docs/multi-tenant-plan.md for full design.

### From codebase audit (2026-06-18)

PR #20 (merged) fixed malformed-JSON 500s, the catalogue insert race, and
the seed count. PR #22 (in review) hardens auth: constant-time JWT check,
UTF-8 JWT, no username enumeration, `token_version` bump on seed reset, and
sliding expiry on every authenticated response. Remaining items:

14. Login rate-limiting — no throttling/lockout on `/api/login`, so it's
    brute-forceable (PBKDF2 only raises per-attempt cost). Needs persistent
    storage; deferred pending a decision between a D1 table and a Cloudflare
    Rate Limiting binding. (Security / High)
15. Meal-plan date off-by-one — `Date.toISOString().slice(0,10)` formats in
    UTC while the week is built in local time, so between local midnight and
    ~02:00 (UTC+1/+2) the whole week, "today", and the saved `plan_date`
    shift back a day. Format from local date components instead. (High)
16. Missing CSS variables `--green` / `--danger` — referenced by the
    change-password button/messages in `public/index.html` but never defined
    in `:root`, so the button renders with no background and messages get no
    colour. Use `--tile` / `--accent` or define the vars. (Medium)
17. No service worker despite the PWA manifest — the app is installable but
    has zero offline capability. Add a minimal app-shell service worker, or
    drop the offline expectation. (Medium)
18. `parseItemInput` mis-parses names containing numbers (e.g. "milk 2",
    "7up") into name+qty. Only treat a standalone leading/trailing integer
    as quantity. (Low)
19. New items are force-uppercased on add (`rawName.toUpperCase()`) while
    seeded catalogue items are Title Case — inconsistent display casing.
    Store as typed and rely on `COLLATE NOCASE`. (Low)
20. Polling runs every 7s regardless of `document.hidden`, and a second
    `showApp()` could stack timers. Guard the interval on visibility and
    clear before re-arming. (Low)
21. Autocomplete suggestions are never hidden on blur/outside-click, so the
    dropdown can linger over other UI. (Low)
22. `viewport` sets `maximum-scale=1.0, user-scalable=no`, disabling
    pinch-zoom — an accessibility regression. (Low)
23. CI pins `trufflesecurity/trufflehog@main` (a moving ref) — pin to a
    release tag or commit SHA. (Low)
24. The Worker serves its own inline copy of the seed form at `/seed.html`
    that has diverged from the static `public/seed.html`; collapse to one
    source of truth. (Low)

## Done

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
      `list_items`. Migration `0003_list_items_qty_notes.sql`; storage/
      display only — entry UI is item #1 above.
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
</content>
