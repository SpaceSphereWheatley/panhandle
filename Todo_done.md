# Done

Completed TODO items, numbered 1 (oldest) to 77 (most recent) — these are a
separate, sequential log distinct from the open-item IDs in `TODO.md` (a
parenthetical like "(9)" inside an entry below instead refers to that entry
having resolved open item #9, back when it was still open). Newest first,
matching `CHANGELOG.md`'s ordering; full "fixed in" version/date detail
lives there, not here. See `TODO.md` for open items.

78. (13) Closed the icon gap: all 710 `COMMON_ITEMS` catalogue entries now
    resolve to an icon via `src/lib/itemIcons.js`'s `MAP`, up from 500 —
    the remaining 210 fell back to a plain first-letter badge in grid view
    before this. Most reused an existing drawing (near-synonym pattern
    already used throughout `MAP`, e.g. many fish species sharing one
    `fish` icon); seven items needed genuinely new hand-drawn art —
    artichoke, a pregnancy test, gloves, a broom, scissors, and a
    cold-pack/heat-pack pouch pair composed from the existing snowflake/sun
    glyphs — verified via a rendered contact-sheet screenshot before
    merging. Added `src/lib/itemIcons.test.js` asserting every
    `COMMON_ITEMS` name resolves to a non-null icon, so future catalogue
    growth regresses loudly instead of silently falling back to the
    letter badge. (1.33.0)
77. (7) Closed out push notifications. Phase 1: Web Push subscribe/
    unsubscribe infrastructure end-to-end — VAPID keys, the
    `push_subscriptions` table, a Settings → "Varsler" enable-notifications
    toggle, and a `*/15 * * * *` cron-driven "no meal planned for
    tomorrow" reminder, deduped per list/day (`notification_log`). Phase
    2: a weekly Sunday-evening reminder that fires only if the upcoming
    week has *zero* planned meals at all (not "few," to avoid an arbitrary
    nag threshold), and an on-demand "get the other person's attention"
    ping (shopping list FAB → "Varsle husstanden", `POST /push/ping`)
    fanned out to every other subscribed device on the list, rate-limited
    to once per 2 minutes per list (`notification_state`). Web Push on iOS
    only works for the PWA installed to the Home Screen (16.4+), not an
    ordinary Safari tab — `VarslerSubpage` shows a hint when that's the
    case. (1.24.0, 1.27.0) Batched item-added notifications — the one
    remaining phase the original item scoped out — were considered and
    declined: the on-demand ping already covers "get my attention," and a
    2-person household doesn't need a third automated notification type
    on top of the two reminders. #7 is fully closed, not deferred.
76. (17) Restructured user identity around three editable fields — **Name**
    (display name, shown throughout the UI), **e-mail**, and **username**,
    where username always mirrors the e-mail. New `users.name` column
    (`0011_user_display_name.sql`); `POST /change-name` edits it (Settings
    → "Meg & min app" → "Navn"), shown wherever a person's identity appears
    (`ProfileIsland`'s "Innlogget som", `MembersIsland`/`AdminIsland`'s
    member lists, meal-responsible avatars/dropdowns via
    `ListUsersContext`'s new `nameFor`, "lagt til av" on items). `POST
    /change-email` now also renames the username to match everywhere it's
    stored by value — `list_items.added_by`, `meal_plan.responsible`,
    `recurring_schedule.responsible`, `users.created_by`,
    `password_resets.username` — via a batched `renameUsername` helper,
    returning a fresh token in the response body since the rename
    invalidates the caller's current one (same pattern as
    `/change-password`'s token_version bump). `POST /register`, `POST
    /admin/owners`, and `POST /list-users` all now take an e-mail + name
    instead of a freeform username — every account has a real e-mail, no
    exception. `POST /auth/google` seeds Name/e-mail from the ID token's
    claims once (new account, or first-time linking), never overwriting a
    later local edit. Existing production accounts (whose usernames
    predated this invariant) were migrated directly via the same cascading
    rename. (1.23.0)
75. (3) Repo cleanup pass: fixed stale claims in `README.md` ("no offline
    mode"/"service worker for offline support" were listed as a limitation
    and a future idea, despite `public/sw.js` already shipping real offline
    app-shell caching), added "Historical" banners to three docs
    (`docs/multi-tenant-plan.md`, `docs/multi-tenant-migration-log.md`,
    `docs/seed-catalogue-deploy.md`) describing already-shipped one-time
    cutovers/deploys — matching the marker `docs/multi-tenant-setup.md`
    already had — and corrected a stale migration filename reference in the
    last one, documented `scripts/compute-icon-offsets.mjs` in `CLAUDE.md`
    (previously undocumented outside its own header comment), and removed
    one dead CSS rule (`src/index.css`'s `#allUsers > .admin-group:first-
    child`, targeting an element ID that doesn't exist anywhere in the
    current React markup). No other dead code, unused exports, or orphaned
    files found in a full pass over `src/`, `worker/index.js`, and
    `public/`. (1.22.7)
74. (16) Split the completed-items log out of `TODO.md` into this file,
    giving every entry a stable sequential number (oldest to newest) instead
    of an unnumbered flat list, while keeping the existing newest-first
    order. `TODO.md`'s open items are now grouped into themed sections
    (Feature, Data model, Performance, UI/Polish) with an explicit priority
    ranking instead of one flat value-sorted list. (1.22.7)
73. (10) Simplified the in-app changelog. `ChangelogModal.jsx` no longer
    fetches raw `/CHANGELOG.md` and dumps the full text into a `<pre>`; a new
    `src/lib/changelogUtils.js`'s `parseChangelog` extracts just each
    version's entry titles (the bold lead sentence of each bullet by
    convention, or its first sentence when unbolded, truncated with an
    ellipsis if unusually long) and the modal links out to the full
    changelog on GitHub for detail. (1.22.7)
72. (9) Made the "Installer Panhandle" install CTA in Settings demote
    instead of staying full-size forever: a persisted `installed` flag
    (`localStorage`, surviving reloads) now demotes it to a compact pill,
    and a new dismiss button demotes it further to a plain text row —
    both quieter-but-still-visible states rather than fully hiding, since
    the underlying signals (a stale `appinstalled`/dismiss flag after an
    uninstall) can't be verified. The full hero CTA stays the default for
    anyone who hasn't installed or dismissed it. (1.22.6)
71. Removed the `/seed` bootstrap endpoint (and its `SEED_SECRET`-gated
    code path, `public/seed.html` form, and all references in
    `wrangler.toml`/`README.md`/`CLAUDE.md`/service worker) now that
    self-service signup (`POST /register`) and Google sign-in (`POST
    /auth/google`) are the real account-creation paths. The Worker no
    longer has any endpoint that can create or reset accounts without an
    existing authenticated session; the `SEED_SECRET` dashboard var
    should also be removed from the Worker's Cloudflare settings since
    nothing reads it anymore. Integration tests' account bootstrap
    (`tests/_helpers.mjs`'s `seedAndLogin`/`bootstrapAccount`) now writes
    directly to the local D1 SQLite file via `wrangler d1 execute
    --local` instead of hitting an HTTP endpoint. (1.22.5)
70. In the meal planner, the "Endre"/"Legg til" button on today's card
    was hard to read in both light and dark mode. Root cause: today's
    card flips to an inverse surface (`background: var(--md-inverse-
    surface)`, `color: var(--md-inverse-on-surface)` in `MealsTab.jsx`),
    but `Button`'s `outline` variant hardcoded `color: var(--text-
    primary)` / `border: var(--border-strong)` — tokens tied to the
    *ambient* theme, not the inverse one. Fixed with a per-instance
    style override on today's button using the matching inverse tokens.
    Verified visually in both color schemes via a local wrangler-dev +
    Vite dev-proxy session. (1.22.4)
69. Bug: switching between grid and list view changed what "Nylig
    kjøpt" showed, not just how it was laid out — the section capped at
    9 items in grid view (3×3) vs. 3 in list view. Unified to a single
    view-independent cap (`BOUGHT_CAP = 9` in `ShoppingListTab.jsx`) so
    toggling the view only changes layout now, confirmed identical item
    sets in both views via a local visual check. (1.22.4)
68. Meal planner week view: non-today day cards are now more compact
    (`Card`'s `padding="sm"` instead of the default `md`, tighter title
    margin, smaller inter-card gap in the mobile stacked layout) so the
    week takes less vertical space overall. Today's card keeps its
    full-size prominent treatment; fitting the entire week without any
    scrolling on every device would need a larger layout rework, not
    attempted here. (1.22.4)
67. In Settings, "Install Panhandle" should be on top. `PwaInstallCTA`
    currently renders second in `SettingsTab.jsx`, after `ProfileIsland`'s
    identity/theme card, both under the "Meg & min app" island label.
    Moving it above `ProfileIsland` (or above the island label entirely) is
    a small JSX reorder, not a redesign.
66. Users can send feedback from the app (Settings → "Send
    tilbakemelding", next to "Hva er nytt?"). A small modal
    (`FeedbackModal.jsx`) with a free-text message emails
    `env.FEEDBACK_EMAIL` via the same Resend integration already used for
    password recovery. New authenticated `POST /feedback`, rate-limited
    5/hour/IP (same `rate_limit_attempts` pattern as
    `/register`/`/forgot-password` — the attempt is recorded right after
    body parse, before validation, matching those endpoints' "volume is
    the abuse vector" reasoning). `FEEDBACK_EMAIL` needs the same manual
    one-time Worker dashboard setup as `RESEND_API_KEY`/
    `TURNSTILE_SECRET_KEY`. (1.21.3)
65. The landing page's shopping-list mockups (`public/index.html`) showed
    a stale UI pattern — per-category header rows (e.g. "Kjøtt og fisk",
    "Meieriprodukter") above groups of items — that the real app no
    longer has; unbought items render as one flat, aisle-sorted list/grid
    with no category dividers since the shopping list's category-section
    removal. Removed the fake headers from both the list-view and
    grid-view mockups; "Nylig kjøpt" keeps its own label since that
    section is still real. Kept as hand-coded CSS mockups rather than
    switching to real captured screenshots — no build step needed,
    matches how the section already worked. (1.21.2)
64. Let the super-admin delete a user account outright (Settings →
    Administrasjon → "Alle brukere" → "Slett", superadmin-only). New
    `DELETE /admin/users/{u}`, gated by `is_admin` + `isSuperAdmin` (same
    double-gate as `GET /admin/metrics`). Refuses (doesn't cascade) if the
    target is the last admin site-wide or the last owner of their list,
    mirroring `PATCH /admin/users/{u}/flags`'s existing guards. (1.21.1)
63. Let a user delete their own account (Settings → Profile → "Slett
    konto"), phase 1 of the account-lifecycle item — still one list per
    user. A non-owner (or an owner with a co-owner) just leaves; the
    list's last/sole owner cascade-deletes the entire list (shopping list,
    meal plan, catalogue, recurring schedule, every other member's
    account too) rather than being refused, since there's no "reassign
    ownership" flow yet. New `DELETE /account`, same current-password +
    IP-throttle pattern as `/change-password`/`/change-email`. "Exist
    without a list" / multi-list membership stays open as a future phase.
    (1.21.0)
62. The recurring meal responsibility section in Settings (`RecurringIsland.jsx`)
    is now minimizable — wrapped in the same `AccordionRow` already used by
    `MembersIsland`'s/`AdminIsland`'s/`ProfileIsland`'s sub-sections, instead
    of always being fully expanded (it previously had an explicit "no
    accordion" design note). Defaults to open, so nothing changes at first
    glance. `HomeIsland.jsx`'s manual divider between `MembersIsland` and
    `RecurringIsland` was removed since `AccordionRow` now supplies its own
    top border, matching how `MembersIsland`'s own two accordions are
    separated. (1.20.3)
61. iOS compatibility pass: added an `apple-touch-icon` (`app.html` and
    `public/index.html` — iOS Safari ignores `manifest.json` icons for
    "Add to Home Screen" entirely and previously fell back to a page
    screenshot), and swapped `100vh` → `100dvh` on the four auth screens
    (`LoginScreen`, `SignupScreen`, `ForgotPasswordScreen`,
    `ResetPasswordScreen`) to fix clipping/phantom-scroll as Safari's
    toolbar chrome shows/hides. Investigated and explicitly deferred:
    swipe-to-mark-bought (confirmed via git history to be an intentional
    v1 simplification carried through two later redesigns, not an iOS
    regression — not restored), the landing page's remaining Apple
    meta tags/`viewport-fit=cover` (low impact since installs go through
    `/app.html`, which already has them), `overscroll-behavior-y:
    contain`'s incomplete support on iOS Safari <16 (no concrete bug,
    closing it needs JS scroll-locking — speculative complexity for a
    2-user app), and general service-worker iOS quirks (no concrete bug
    found in `public/sw.js`). (1.20.2)
60. The landing page's "Registrer deg" button opened a static "we're in
    closed beta, contact Mohibb" modal — a leftover from before
    self-service signup shipped (1.20.0). It now links straight to the
    real signup screen (`/app.html?signup=1`, a new query param
    `AuthScreens.jsx` reads alongside its existing `reset_token`
    handling); the dead modal markup/CSS/JS in `public/index.html` was
    removed. The in-app login screen's own "Opprett ny husstand" button
    was already correctly wired to the signup flow and needed no change.
    (1.20.1)
59. `HomeIsland.jsx` now reads `isOwner` itself via `useAuth()` instead of
    taking it as a prop threaded from `SettingsTab.jsx`, matching
    `AdminIsland`'s already-self-contained permission check — one
    consistent pattern ("each settings island determines its own
    permission-gated rendering via `useAuth()` directly") instead of two.
    (1.19.3)
58. Adopted `Sheet.jsx`'s `title` prop everywhere: `Modal.jsx` now
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
57. Removed the 8 dead `// eslint-disable-next-line
    react-hooks/exhaustive-deps` comments (`ShoppingListTab`, `MealsTab`,
    `useDeployVersionCheck`, `RecurringIsland`, `MealPlanModal`,
    `IngredientPickerModal`, `MealEditModal`, `WeekIngredientsModal`) —
    ESLint isn't installed or configured, so they were inert. (1.19.3)
56. Investigated grid-view single-item category rows: the shopping list
    already renders one continuous flat grid across category boundaries
    (aisle-sorted, no per-category `CatSection`/grid break) rather than
    per-category grids — that restructuring must have already happened
    by the time this item was written. Re-verified there's no visible
    "unfinished row" artifact; no code change needed. (1.19.2)
55. Bumped the suggest-item add button (`SuggestionsModal`) and the
    meal-name dropdown arrow (`MealPlanModal`) from 32px to 48px/40px
    respectively, closer to the ~44–48px touch-target guideline.
    (Bottom-nav tab buttons and the ingredient-row checkboxes were
    re-measured and already meet it — the nav button's full flex column
    is ~58px tall, and the ingredient checklist's whole row, not just
    the 24px checkbox glyph, is the actual ~48px tap target — so neither
    needed a change.) (1.19.2)
54. Extended the same Framer Motion enter/exit/layout treatment used by
    `ItemCard`/`ItemGridCard`/`MealsTab` (respecting
    `prefers-reduced-motion`/design-intensity gating via
    `useMotionConfig`) to `AdminIsland`/`MembersIsland`'s user rows.
    (1.19.2)
53. `AppShell.jsx` now keeps `SettingsTab` mounted-but-hidden after first
    visit (same persist-after-first-visit pattern already used for
    `ShoppingListTab`/`MealsTab`), instead of mounting/unmounting it on
    every tab switch — it no longer re-fetches admin counts, user lists,
    and recurring-meal config from scratch every time. (1.19.1)
52. Added `ConfirmContext`/`useConfirm` — a promise-based, app-styled
    replacement for native `confirm()` (mirrors `ToastContext`'s shape).
    Every destructive/sensitive action now confirms through it
    consistently: catalogue-meal delete, deleting a planned day
    (previously had no confirmation at all), forgetting a catalogue
    item, admin/owner flag changes (previously had no confirmation),
    password reset, and member removal. (1.19.0)
51. Standardized error/feedback presentation on toast with one
    consistent error color, replacing the mixed inline-`<div>`
    (inconsistent `--status-danger`/`--accent-primary`)/`alert()`/
    silent-catch channels across `ItemEditModal`, `MealEditModal`,
    `AdminIsland`, `MembersIsland`, and `ProfileIsland`. (1.19.0)
50. Added a shared `LoadingState`/`Spinner` (design-system) and used it
    for `ShoppingListTab`/`MealsTab`'s initial fetch (previously no
    loading state at all — indistinguishable from a genuinely empty
    list/week) and to replace the ad hoc blank-list/bare-modal-shell
    gaps in `MealPlanModal`, `MealCatalogueBrowseModal`,
    `WeekIngredientsModal`, and `IngredientPickerModal`. (`AdminIsland`'s
    per-tile `"–"` placeholders were left as-is — a full-screen spinner
    would block the whole dashboard behind independently-loading
    stats, which is a worse tradeoff for that layout.) (1.19.0)
49. Added a shared `EmptyState` component (design-system) and used it
    for the shopping list's empty block and the empty-list cases in
    `SuggestionsModal`, `WeekIngredientsModal`, and
    `MealCatalogueBrowseModal`, replacing the shared-but-unrelated
    `.cred-note` paragraph class those previously borrowed. (1.19.0)
48. `MealPlanModal`'s save/delete are now optimistic (update local plan
    state immediately, roll back with a toast on failure), matching the
    shopping-list toggle pattern, instead of blocking the modal open on
    a full network round trip. (1.19.0)
47. Every modal's Cancel/Save pair now uses the shared
    `design-system/components/forms/Button.jsx` instead of raw
    `<button className="cancel/save">`; the now-dead `.modal .save`/
    `.modal .cancel` CSS rules were removed. (1.18.4)
46. Migrated every hand-copied inline-style text field
    (`ItemEditModal`, `MealEditModal`, `MealPlanModal`'s
    responsible-person field, `AdminIsland`, `MembersIsland`,
    `ProfileIsland`'s password fields, `RecurringIsland`) onto the
    shared `design-system/components/forms/Input.jsx`, which now also
    forwards `id`/arbitrary props so it works with `htmlFor` labels and
    native attributes like `list`/`min`. (1.18.4)
45. Migrated real icon-only buttons (`InstallBanner`'s dismiss,
    `MealPlanModal`'s dropdown chevron, `SuggestionsModal`'s add chip)
    onto `design-system/components/forms/IconButton.jsx`, which now
    also accepts a `style` override for cases needing custom
    positioning. (`LoginScreen`'s show/hide toggle is text-labeled, not
    icon-only, so it was left as-is.) (1.18.4)
44. `MembersIsland.jsx`'s hand-rolled "Eier"/"Admin" pills now use the
    shared `Badge` component; the now-dead `.badge-tag` CSS was removed.
    (1.18.4)
43. Routed the app's actually-duplicated semantic icons (the
    expand/collapse chevron in `ShoppingListTab`/`AccordionRow`, and the
    list/grid view toggle) through `UiIcon`/`uiIcons.js` instead of raw
    `<i className="ph ph-{slug}">`, normalizing the collapse chevron to
    one consistent size everywhere it's used as a plain indicator.
    `UiIcon` now supports a `weight="fill"` prop and a `style` override.
    Design-system primitives (`Button`, `IconButton`, `Input`,
    `FabMenu`, `Checkbox`, `Header`, `ListItem`) keep rendering their own
    raw icon prop directly, by design — they're generic icon slots, not
    duplicates of `UiIcon`'s semantic lookup. (1.18.4)
42. `RecurringContext.jsx`'s save/reload path returns `{ error }`;
    `RecurringIsland.jsx` (`onSelectChange`/`onOtherBlur`) now reads it
    and surfaces failures via toast instead of dropping them silently.
    (1.18.3)
41. Investigated whether `ShoppingListTab`'s 7s poll can interrupt the
    400ms local item-resolve animation: not reproducible — the toggled
    item's `bought` state flips optimistically before the resolve delay
    starts, `resolvingIds` (which gates the animation) is driven only by
    a local timer untouched by `loadList`, and React's style diffing
    never reassigns `animation` to the DOM node when the computed string
    is unchanged between renders, so a same-state poll mid-window can't
    restart the CSS animation. No code change made. (1.18.3)
40. `CredentialsModal`'s `copyInvite` now surfaces clipboard
    success/failure via toast and only closes the modal after a
    successful copy. (1.18.3)
39. Shopping list items (`ItemCard.jsx`/`ItemGridCard.jsx`) are now
    keyboard/screen-reader reachable (`role="button" tabIndex={0}` +
    Enter/Space toggles bought), matching `PwaInstallCTA.jsx`'s pattern.
    (1.18.2)
38. Modals (`Sheet.jsx`) now move focus in on open, trap `Tab`, restore
    focus to the trigger on close, and expose `role="dialog"`/
    `aria-modal`, matching `FabMenu.jsx`'s focus-move approach. (1.18.2)
37. Form labels in `ItemEditModal`, `MealEditModal`, `MealPlanModal`, and
    the admin/member/recurring settings forms are now programmatically
    associated with their inputs (`htmlFor`/`id`, or `aria-label`/
    `aria-labelledby`); `ProfileIsland`'s password fields gained visible
    labels. (1.18.2)
36. `--text-tertiary` in light mode moved from `--nv-50` to `--nv-40`
    (~6.5:1 contrast against card/page surfaces, up from ~3.9–4.1:1) to
    meet WCAG AA. (1.18.2)
35. `Header.jsx`'s back-caret button now has an `aria-label`. (1.18.2)
34. The toast container now has `role="status"`/`aria-live="polite"`.
    (1.18.2)
33. CI pinned `trufflesecurity/trufflehog@main` (a moving ref) — pinned to
    the `v3.95.9` release commit SHA instead. (1.15.0)
32. No `Escape` key handler on any modal — a `keydown` listener on
    `Sheet.jsx` (shared by all modals via `Modal.jsx`) now calls `onClose`
    on Escape. (1.15.0)
31. `public/sw.js` was a network-passthrough stub with no caching, so the
    app had zero offline capability despite being installable — now does
    stale-while-revalidate app-shell caching (everything except `/api/*`
    and `/seed`, which always hit the network). (1.15.0)
30. `migrations/0004_seed_catalogue.sql` referenced the `lists` table and
    `list_id` column that didn't exist until `0005_multi_tenant.sql` ran
    after it — applying migrations in numbered order on a fresh D1
    instance failed outright at 0004. Fixed by squashing all of
    0001-0007 into one consolidated `migrations/0001_init.sql` (this
    project has exactly one deployment, so there's no cross-environment
    migration history to preserve); the two remaining files
    (`0002_seed_catalogue.sql`, `0003_expand_catalogue.sql`) are pure,
    order-independent data seeds that now correctly depend on schema
    that already exists from `0001_init.sql`.
29. Grid view long-press to open the item modal didn't work reliably on
    touch (jitter canceled the timer); also fixed via a button/tap-target
    affordance. (1.0.7)
28. Polling ran every 7s regardless of `document.hidden`, and a second
    `showApp()` could stack timers — interval now guarded on visibility
    and cleared before re-arming. (1.0.8)
27. `viewport` disabled pinch-zoom via `maximum-scale=1.0,
    user-scalable=no` — removed for accessibility (T12). (1.0.9)
26. Meal ingredients → shopping list: a "+ Legg ingredienser på
    handlelisten" button on the meal modal lets you pick which of a
    meal's stored ingredients to add (T1). (1.0.11)
25. Item detail modal: rename the catalogue entry itself, or delete it
    entirely (cascades to every list it appears on). (1.0.6)
24. Autocomplete: explicit "add exactly as typed" bypass option, plus
    `parseItemInput` no longer treats a trailing number as quantity
    (e.g. "milk 2" no longer hijacked into "milk" x2). (1.0.6)
23. Autocomplete dropdown now dismissed on outside click instead of
    lingering over other UI. (1.0.6)
22. Multi-owner lists, admin-created accounts, per-list isolation — see
    `docs/multi-tenant-plan.md`. Originally migration `0005_multi_tenant.sql`,
    now folded into the consolidated `migrations/0001_init.sql`.
21. Login rate-limiting — `login_attempts` D1 table, 429 after 10 failures
    per IP in a 15-minute window. (1.0.4)
20. Meal-plan date off-by-one — local date components instead of
    `toISOString()`. (1.0.1)
19. Missing `--green`/`--danger` CSS variables. (1.0.4)
18. `parseItemInput` mis-parsing names containing numbers. (1.0.5)
17. New shopping-list items force-uppercased instead of stored as typed.
    (1.0.5)
16. Meal plan: surface `meal_catalogue.ingredients` in the UI. (1.0.5)
15. Worker's stale inline `/seed.html` copy, duplicating
    `public/seed.html`. (1.0.5)
14. Item detail modal: long-press the card or tap "⋮" to edit category,
    quantity, and notes (`PATCH /api/list/:id`).
13. Allow editing an item's category from the item modal.
12. Empty states for the shopping list ("Ingen varer på listen").
11. Basic offline/slow-network handling — `syncStatus` shows
    "Offline"/"Kunne ikke oppdatere" on failed polls, browser
    online/offline events trigger an immediate retry.
10. Meal plan UI: Monday–Sunday week view with prev/next/this-week nav.
9. Make layout mobile-first but consistent at desktop widths too — cap
   content width (e.g. `max-width: 480px`, centered) instead of a
   separate desktop layout.
8. Add a `notes` (free text — quantity, description, etc.) column to
   `list_items`. Originally migration `0003_list_items_qty_notes.sql`,
   now folded into the consolidated `migrations/0001_init.sql`.
7. Quantity-aware "merge" when adding an item that's already on the
   list unbought (previously created duplicate rows against the same
   catalogue entry).
6. Grid view for the shopping list as an alternative to the list view
   (toggle between the two), 3-column, with a circular first-letter
   badge placeholder icon per item.
5. Swipe-to-mark-bought on shopping list cards (swipe left past a
   threshold), separate from the long-press-for-modal gesture.
4. PWA install prompt banner (native `beforeinstallprompt` on
   Chrome/Android, share-sheet instructions on iOS Safari), dismissible
   and remembered in `localStorage`.
3. Emoji icon set for common catalogue items (`public/itemIcons.js`).
2. Icon lookup by normalized item name, falling back to the
   first-letter badge in grid view when no icon is mapped.
1. Settings view listing catalogue items that don't have a matching
   icon yet, to help decide what to design next.
