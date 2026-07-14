# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed, just strike them and move to Done; re-pack (renumber) only
when the open list gets sparse, as just happened here. Full "fixed in"
details live in `CHANGELOG.md`, not here.

1. Poll interval is a fixed 7s with no backoff when the tab is idle (no
   interaction for a while) but visible. At 2 users on D1 this costs
   nothing today — only worth doing once user count or request volume
   actually grows, and it trades off responsiveness (stale data right
   after returning from idle) for load savings, so don't add it
   speculatively.
   _Value: Low · Importance: Low · Type: Performance_

## Done

- [x] `HomeIsland.jsx` now reads `isOwner` itself via `useAuth()` instead of
      taking it as a prop threaded from `SettingsTab.jsx`, matching
      `AdminIsland`'s already-self-contained permission check — one
      consistent pattern ("each settings island determines its own
      permission-gated rendering via `useAuth()` directly") instead of two.
      (1.19.3)
- [x] Adopted `Sheet.jsx`'s `title` prop everywhere: `Modal.jsx` now
      forwards a `title` prop to `Sheet`, and all ~11 modal call sites
      (`ItemEditModal`, `MealEditModal`, `MealPlanModal` ×2,
      `SuggestionsModal`, `WeekIngredientsModal`,
      `MealCatalogueBrowseModal`, `IngredientPickerModal`,
      `InstallHelpModal`, `CredentialsModal`, `ChangelogModal`,
      `ConfirmContext`) pass it instead of hand-rolling their own `<h3>` —
      the now-dead `.modal h3` CSS rule was removed. Also removed the
      orphaned `.theme-toggle` CSS rule. (`.setrow`, also flagged as
      orphaned, turned out to now be in active use by `MetricsSettings.jsx`
      — left in place.) (1.19.3)
- [x] Removed the 8 dead `// eslint-disable-next-line
      react-hooks/exhaustive-deps` comments (`ShoppingListTab`, `MealsTab`,
      `useDeployVersionCheck`, `RecurringIsland`, `MealPlanModal`,
      `IngredientPickerModal`, `MealEditModal`, `WeekIngredientsModal`) —
      ESLint isn't installed or configured, so they were inert. (1.19.3)
- [x] Investigated grid-view single-item category rows: the shopping list
      already renders one continuous flat grid across category boundaries
      (aisle-sorted, no per-category `CatSection`/grid break) rather than
      per-category grids — that restructuring must have already happened
      by the time this item was written. Re-verified there's no visible
      "unfinished row" artifact; no code change needed. (1.19.2)
- [x] Bumped the suggest-item add button (`SuggestionsModal`) and the
      meal-name dropdown arrow (`MealPlanModal`) from 32px to 48px/40px
      respectively, closer to the ~44–48px touch-target guideline.
      (Bottom-nav tab buttons and the ingredient-row checkboxes were
      re-measured and already meet it — the nav button's full flex column
      is ~58px tall, and the ingredient checklist's whole row, not just
      the 24px checkbox glyph, is the actual ~48px tap target — so neither
      needed a change.) (1.19.2)
- [x] Extended the same Framer Motion enter/exit/layout treatment used by
      `ItemCard`/`ItemGridCard`/`MealsTab` (respecting
      `prefers-reduced-motion`/design-intensity gating via
      `useMotionConfig`) to `AdminIsland`/`MembersIsland`'s user rows.
      (1.19.2)
- [x] `AppShell.jsx` now keeps `SettingsTab` mounted-but-hidden after first
      visit (same persist-after-first-visit pattern already used for
      `ShoppingListTab`/`MealsTab`), instead of mounting/unmounting it on
      every tab switch — it no longer re-fetches admin counts, user lists,
      and recurring-meal config from scratch every time. (1.19.1)
- [x] Added `ConfirmContext`/`useConfirm` — a promise-based, app-styled
      replacement for native `confirm()` (mirrors `ToastContext`'s shape).
      Every destructive/sensitive action now confirms through it
      consistently: catalogue-meal delete, deleting a planned day
      (previously had no confirmation at all), forgetting a catalogue
      item, admin/owner flag changes (previously had no confirmation),
      password reset, and member removal. (1.19.0)
- [x] Standardized error/feedback presentation on toast with one
      consistent error color, replacing the mixed inline-`<div>`
      (inconsistent `--status-danger`/`--accent-primary`)/`alert()`/
      silent-catch channels across `ItemEditModal`, `MealEditModal`,
      `AdminIsland`, `MembersIsland`, and `ProfileIsland`. (1.19.0)
- [x] Added a shared `LoadingState`/`Spinner` (design-system) and used it
      for `ShoppingListTab`/`MealsTab`'s initial fetch (previously no
      loading state at all — indistinguishable from a genuinely empty
      list/week) and to replace the ad hoc blank-list/bare-modal-shell
      gaps in `MealPlanModal`, `MealCatalogueBrowseModal`,
      `WeekIngredientsModal`, and `IngredientPickerModal`. (`AdminIsland`'s
      per-tile `"–"` placeholders were left as-is — a full-screen spinner
      would block the whole dashboard behind independently-loading
      stats, which is a worse tradeoff for that layout.) (1.19.0)
- [x] Added a shared `EmptyState` component (design-system) and used it
      for the shopping list's empty block and the empty-list cases in
      `SuggestionsModal`, `WeekIngredientsModal`, and
      `MealCatalogueBrowseModal`, replacing the shared-but-unrelated
      `.cred-note` paragraph class those previously borrowed. (1.19.0)
- [x] `MealPlanModal`'s save/delete are now optimistic (update local plan
      state immediately, roll back with a toast on failure), matching the
      shopping-list toggle pattern, instead of blocking the modal open on
      a full network round trip. (1.19.0)
- [x] Every modal's Cancel/Save pair now uses the shared
      `design-system/components/forms/Button.jsx` instead of raw
      `<button className="cancel/save">`; the now-dead `.modal .save`/
      `.modal .cancel` CSS rules were removed. (1.18.4)
- [x] Migrated every hand-copied inline-style text field
      (`ItemEditModal`, `MealEditModal`, `MealPlanModal`'s
      responsible-person field, `AdminIsland`, `MembersIsland`,
      `ProfileIsland`'s password fields, `RecurringIsland`) onto the
      shared `design-system/components/forms/Input.jsx`, which now also
      forwards `id`/arbitrary props so it works with `htmlFor` labels and
      native attributes like `list`/`min`. (1.18.4)
- [x] Migrated real icon-only buttons (`InstallBanner`'s dismiss,
      `MealPlanModal`'s dropdown chevron, `SuggestionsModal`'s add chip)
      onto `design-system/components/forms/IconButton.jsx`, which now
      also accepts a `style` override for cases needing custom
      positioning. (`LoginScreen`'s show/hide toggle is text-labeled, not
      icon-only, so it was left as-is.) (1.18.4)
- [x] `MembersIsland.jsx`'s hand-rolled "Eier"/"Admin" pills now use the
      shared `Badge` component; the now-dead `.badge-tag` CSS was removed.
      (1.18.4)
- [x] Routed the app's actually-duplicated semantic icons (the
      expand/collapse chevron in `ShoppingListTab`/`AccordionRow`, and the
      list/grid view toggle) through `UiIcon`/`uiIcons.js` instead of raw
      `<i className="ph ph-{slug}">`, normalizing the collapse chevron to
      one consistent size everywhere it's used as a plain indicator.
      `UiIcon` now supports a `weight="fill"` prop and a `style` override.
      Design-system primitives (`Button`, `IconButton`, `Input`,
      `FabMenu`, `Checkbox`, `Header`, `ListItem`) keep rendering their own
      raw icon prop directly, by design — they're generic icon slots, not
      duplicates of `UiIcon`'s semantic lookup. (1.18.4)
- [x] `RecurringContext.jsx`'s save/reload path returns `{ error }`;
      `RecurringIsland.jsx` (`onSelectChange`/`onOtherBlur`) now reads it
      and surfaces failures via toast instead of dropping them silently.
      (1.18.3)
- [x] Investigated whether `ShoppingListTab`'s 7s poll can interrupt the
      400ms local item-resolve animation: not reproducible — the toggled
      item's `bought` state flips optimistically before the resolve delay
      starts, `resolvingIds` (which gates the animation) is driven only by
      a local timer untouched by `loadList`, and React's style diffing
      never reassigns `animation` to the DOM node when the computed string
      is unchanged between renders, so a same-state poll mid-window can't
      restart the CSS animation. No code change made. (1.18.3)
- [x] `CredentialsModal`'s `copyInvite` now surfaces clipboard
      success/failure via toast and only closes the modal after a
      successful copy. (1.18.3)
- [x] Shopping list items (`ItemCard.jsx`/`ItemGridCard.jsx`) are now
      keyboard/screen-reader reachable (`role="button" tabIndex={0}` +
      Enter/Space toggles bought), matching `PwaInstallCTA.jsx`'s pattern.
      (1.18.2)
- [x] Modals (`Sheet.jsx`) now move focus in on open, trap `Tab`, restore
      focus to the trigger on close, and expose `role="dialog"`/
      `aria-modal`, matching `FabMenu.jsx`'s focus-move approach. (1.18.2)
- [x] Form labels in `ItemEditModal`, `MealEditModal`, `MealPlanModal`, and
      the admin/member/recurring settings forms are now programmatically
      associated with their inputs (`htmlFor`/`id`, or `aria-label`/
      `aria-labelledby`); `ProfileIsland`'s password fields gained visible
      labels. (1.18.2)
- [x] `--text-tertiary` in light mode moved from `--nv-50` to `--nv-40`
      (~6.5:1 contrast against card/page surfaces, up from ~3.9–4.1:1) to
      meet WCAG AA. (1.18.2)
- [x] `Header.jsx`'s back-caret button now has an `aria-label`. (1.18.2)
- [x] The toast container now has `role="status"`/`aria-live="polite"`.
      (1.18.2)
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
