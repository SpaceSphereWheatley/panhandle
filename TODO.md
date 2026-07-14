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
8. `design-system/components/forms/IconButton.jsx` enforces an
   `aria-label` via its required `label` prop, but has zero real usages —
   every actual icon-only button in the app is hand-rolled instead
   (`InstallBanner`, `LoginScreen`, `MealPlanModal`'s chevron,
   `SuggestionsModal`'s add chip), so labeling is consistent only by
   luck. Migrate icon-only buttons onto `IconButton`.
   _Value: Medium · Importance: Medium · Type: Accessibility_
10. Three styling systems coexist permanently rather than mid-migration
    (`src/index.css`'s own header comment admits it): the token-driven
    `src/design-system/`, legacy `index.css` classnames (`.cancel`,
    `.save`, `.btn-primary`), and hand-copied inline `style={{}}` objects.
    Every modal's own Cancel/Save pair uses raw
    `<button className="cancel/save">` instead of the shared `Button`
    component. Consolidate onto `design-system/components/forms/Button.jsx`.
    _Value: Medium · Importance: Medium · Type: Consistency_
11. `Input` (`design-system/components/forms/Input.jsx`) is used in only 2
    files (`LoginScreen`, the shopping-list add-item field); every other
    text field (`ItemEditModal`, `MealEditModal`, `MealPlanModal`'s
    responsible-person field, `AdminIsland`, `MembersIsland`,
    `ProfileIsland`'s password fields, `RecurringIsland`) hand-copies its
    own inline-style object, and these copies have already drifted
    (`ProfileIsland`'s password fields are missing `background`/`color`
    tokens the others have). Migrate to the shared `Input`.
    _Value: Medium · Importance: Medium · Type: Consistency_
12. `Badge` (`design-system/components/data-display/Badge.jsx`) has 0
    usages anywhere — `MembersIsland.jsx` hand-rolls "Eier"/"Admin" pills
    as raw `<span className="badge-tag">` instead. Migrate to `Badge`.
    _Value: Low · Importance: Low · Type: Consistency_
13. Phosphor icons are rendered via a raw `<i className="ph ph-{slug}">`
    with a hand-set `fontSize` almost everywhere, even though a semantic
    wrapper (`UiIcon.jsx` + `uiIcons.js`) exists specifically to
    centralize icon choice/sizing — it's used at only 3 call sites. The
    same semantic icon (e.g. chevron-down) currently renders at
    13/14/15px in different places, and only `TabBar` ever applies the
    `ph-fill` active-weight variant.
    _Value: Low · Importance: Low · Type: Consistency_
14. Error/feedback presentation is split across four channels — toast
    (`ToastContext`), inline colored `<div>` messages (with the error
    color itself inconsistent: `--status-danger` in some forms,
    `--accent-primary` in others, e.g. `AdminIsland.jsx`/
    `MembersIsland.jsx`), native `alert()`/`confirm()`, and silently
    swallowed catches — sometimes mixed within the same file
    (`AdminIsland.jsx` uses inline text for one error, `alert()` for
    another). Standardize on toast with one consistent error color.
    _Value: Medium · Importance: Medium · Type: Consistency_
15. `RecurringContext.jsx`'s save/reload path returns `{ error }`, but
    `RecurringIsland.jsx` (`onSelectChange`/`onOtherBlur`) never reads
    it — a designed error-feedback path that's dead on arrival, silently
    dropping save failures.
    _Value: Medium · Importance: Medium · Type: Bug_
16. Confirmation before destructive actions is inconsistent between
    near-identical sibling actions: deleting a catalogue meal
    (`MealEditModal`) confirms via `window.confirm`, deleting a planned
    day (`MealPlanModal.deletePlanDay`) does not. Toggling a user's
    admin/owner flag (`AdminIsland.setFlag`) has no confirmation, while
    removing a member does. Make confirmation consistent for all
    destructive/sensitive actions, ideally via a custom modal rather than
    native `confirm()`.
    _Value: Medium · Importance: Medium · Type: UX_
17. `ShoppingListTab`/`MealsTab` have no `loading` state at all — the
    initial fetch is visually indistinguishable from a genuinely empty
    list/week. Three other ad hoc "loading" conventions exist elsewhere
    (`AdminIsland`'s `"–"` placeholders, `MealPlanModal`'s bare modal
    shell, `MealCatalogueBrowseModal`'s blank list). Add one shared
    loading indicator/state and use it consistently.
    _Value: Medium · Importance: Medium · Type: UX_
18. No shared empty-state component exists; each screen has its own
    copy/styling convention (shopping list's bespoke block vs. three
    modals sharing a `.cred-note` paragraph class vs. the meals week/
    members list having no distinct empty treatment at all).
    _Value: Low · Importance: Low · Type: Consistency_
19. Shopping-item toggle is optimistic (with rollback-on-failure and a
    400ms local "resolve" animation), but `MealPlanModal.savePlan`/
    `deletePlanDay` has no optimistic update at all — it blocks on a full
    network round trip with the modal staying open. Bring meal editing in
    line with the shopping-list pattern.
    _Value: Medium · Importance: Low · Type: UX_
20. `ShoppingListTab`'s 7s poll (`loadList`) can in principle fire
    mid-way through the 400ms local item-resolve animation window,
    interrupting it. Confirm whether this is observable in practice and
    guard the resolve window against an in-flight poll if so.
    _Value: Low · Importance: Low · Type: Bug (needs investigation)_
21. `AppShell.jsx` keeps `ShoppingListTab`/`MealsTab` mounted-but-hidden
    after first visit, but `SettingsTab` is conditionally
    mounted/unmounted on every tab switch, so it re-fetches admin counts,
    user lists, and recurring-meal config from scratch every time. Align
    it with the same persist-after-first-visit pattern.
    _Value: Medium · Importance: Low · Type: Performance_
22. Admin-only content is gated at the top `SettingsTab` level (whole
    island incl. heading), while owner-only content is gated one level
    down inside `HomeIsland`'s body — two different mechanisms for
    structurally similar "privileged section" cases. Pick one pattern and
    apply it consistently.
    _Value: Low · Importance: Low · Type: Consistency_
23. Touch targets vary widely for conceptually similar controls:
    bottom-nav tab buttons ~40px tall, the suggest-item add button and
    meal-name dropdown arrow are 32px, ingredient checkboxes are 20px, vs.
    the FAB (56px) and FabMenu items (48px) used for similar "add"
    actions. Bring these closer to a consistent ~44–48px minimum.
    _Value: Low · Importance: Low · Type: UX (visual polish)_
24. `ItemCard`/`ItemGridCard`/`MealsTab` use Framer Motion for enter/
    exit/layout animation, but `AdminIsland`/`MembersIsland` rows mount/
    unmount with no animation. Extend the same motion treatment
    (respecting the existing `prefers-reduced-motion`/design-intensity
    gating) to settings-tab lists.
    _Value: Low · Importance: Low · Type: UX (visual polish)_
25. `Sheet.jsx`'s `title` prop is fully wired but never passed anywhere —
    every modal hand-rolls its own `<h3>` instead. Either adopt it
    everywhere or remove the prop. Also remove the orphaned
    `.theme-toggle`/`.setrow` CSS rules in `index.css` (zero remaining
    references since `ProfileIsland` switched to `SegmentedControl`).
    _Value: Low · Importance: Low · Type: Cleanup_
26. 8 `// eslint-disable-next-line react-hooks/exhaustive-deps` comments
    exist across the codebase (`ShoppingListTab`, `MealsTab`,
    `MealPlanModal`, `MealEditModal`, `RecurringIsland`), but ESLint
    isn't installed (absent from `package.json`/`node_modules`) and no
    config file exists, so these directives are currently inert. Either
    add ESLint as a devDependency with a matching config, or remove the
    dead comments.
    _Value: Low · Importance: Low · Type: Cleanup_
27. `CredentialsModal`'s `copyInvite` swallows
    `navigator.clipboard.writeText` failures silently (no toast either
    way) and closes the modal unconditionally regardless of whether the
    copy succeeded. Surface success/failure via toast and only close
    after a successful copy.
    _Value: Low · Importance: Low · Type: Bug_

## Done

- [x] Shopping list items (`ItemCard.jsx`/`ItemGridCard.jsx`) are now
      keyboard/screen-reader reachable (`role="button" tabIndex={0}` +
      Enter/Space toggles bought), matching `PwaInstallCTA.jsx`'s pattern.
      (1.18.1)
- [x] Modals (`Sheet.jsx`) now move focus in on open, trap `Tab`, restore
      focus to the trigger on close, and expose `role="dialog"`/
      `aria-modal`, matching `FabMenu.jsx`'s focus-move approach. (1.18.1)
- [x] Form labels in `ItemEditModal`, `MealEditModal`, `MealPlanModal`, and
      the admin/member/recurring settings forms are now programmatically
      associated with their inputs (`htmlFor`/`id`, or `aria-label`/
      `aria-labelledby`); `ProfileIsland`'s password fields gained visible
      labels. (1.18.1)
- [x] `--text-tertiary` in light mode moved from `--nv-50` to `--nv-40`
      (~6.5:1 contrast against card/page surfaces, up from ~3.9–4.1:1) to
      meet WCAG AA. (1.18.1)
- [x] `Header.jsx`'s back-caret button now has an `aria-label`. (1.18.1)
- [x] The toast container now has `role="status"`/`aria-live="polite"`.
      (1.18.1)
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
