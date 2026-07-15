# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed, just strike them and move to Done; re-pack (renumber) only
when the open list gets sparse, as just happened here. Full "fixed in"
details live in `CHANGELOG.md`, not here.

1. Let a user exist without a list, and let anyone create lists, be members
   of multiple lists, and choose between them (phase 2 of the account-
   lifecycle item — phase 1, self-delete under the one-list-per-user model,
   shipped in 1.21.0). Every user today is still tied to exactly one
   `list_id` (see CLAUDE.md's multi-tenant model); this phase is the actual
   data-model change (nullable list membership, an N:N user↔list join
   instead of a single FK, a "choose/create list" UI) that phase 1
   deliberately deferred.
   _Value: High · Importance: Low · Type: Data model / Account lifecycle_

7. Enable notifications properly. Possible notifications: items added to
   the list (batched), no meal planned for tomorrow, a weekly reminder to
   plan meals, a custom "get the other person's attention" ping, etc.
   Currently there's no notification code at all — `public/sw.js` only
   does app-shell caching (no `push`/`notificationclick` listeners), and
   no subscription endpoint exists in `worker/index.js`. Needs Web Push
   infrastructure end-to-end: VAPID keys, a `push_subscriptions` table/
   migration, a subscribe flow in the frontend, and a Worker-side trigger
   per notification type — the "no meal planned"/"weekly reminder" ones
   also need a cron trigger, which the Worker doesn't have today. The
   biggest lift of any item here, but meaningfully useful for a
   2-person household.
   _Value: High · Importance: Low · Type: Feature_

14. Disable/remove the `/seed` endpoint's `SEED_SECRET` from the Worker's
    Cloudflare dashboard vars (Settings → Variables and Secrets) now that
    self-service signup (`POST /register`) and Google sign-in (`POST
    /auth/google`) are the real account-creation paths — see CLAUDE.md's
    Auth model, which explicitly calls for reminding the user of this
    every session. `/seed` (`worker/index.js:1151`) is secret-gated, but
    a leaked/guessed secret would let anyone create accounts or reset any
    existing user's password; removing the dashboard var is a one-time,
    no-deploy operational step, not a code change.
    _Value: Medium · Importance: Medium · Type: Ops / Security_

3. Go through the whole repo to clean up the code, remove stale/old code
   and files, and restructure if needed. A lot of this already happens
   incrementally (dead CSS/comments removed across 1.18.x–1.19.x, the old
   vanilla app deleted), but drift keeps reappearing — e.g. this session
   found CLAUDE.md's own versioning section describing a two-file version
   bump that's actually been consolidated into `shared/version.js`, and a
   manual `public/CHANGELOG.md` copy step that's actually automated via
   `scripts/sync-changelog.mjs`. Worth a pass over docs (CLAUDE.md itself)
   as much as code.
   _Value: Medium · Importance: Low · Type: Tech debt / Docs_

15. Add language support (i18n). The UI is currently 100% hardcoded
    Norwegian strings across every tab/component/modal — no translation
    layer, no string-key extraction, no language switcher. Needs a
    translation infrastructure decision (a lightweight locale →
    string-map approach fits this app's size better than pulling in a
    full i18n library), a language switcher (Settings, persisted
    per-device like theme), then extracting/translating every existing
    string. Large, cross-cutting effort — touches nearly every component,
    not a contained feature.
    _Value: Medium · Importance: Low · Type: Feature / i18n_

5. Poll interval is a fixed 7s with no backoff when the tab is idle (no
   interaction for a while) but visible. At 2 users on D1 this costs
   nothing today — only worth doing once user count or request volume
   actually grows, and it trades off responsiveness (stale data right
   after returning from idle) for load savings, so don't add it
   speculatively.
   _Value: Low · Importance: Low · Type: Performance_

10. Simplify the in-app changelog. `ChangelogModal.jsx` currently just
    fetches raw `/CHANGELOG.md` and dumps it verbatim into a `<pre>` —
    the full text of every entry, not just titles. Should show entry
    titles only, with a link out to the full changelog (GitHub, or a
    page on the landing site) for detail.
    _Value: Low · Importance: Low · Type: UI / Polish_

9. Make the install button smaller (less prominent) if the app is already
   installed. `PwaInstallCTA.jsx` already hides itself when
   `isStandalone()` is true (launched from the home-screen icon) or
   `installed` is set — but `installed` (`InstallPromptContext.jsx`) only
   ever flips true via the `appinstalled` event firing *in that page
   load*. A user who installed previously but opens the site in an
   ordinary browser tab (not the installed app) gets no signal they're
   already installed, so the full-prominence CTA keeps showing every
   time. Needs a persisted "already installed" flag (e.g. set in
   `localStorage` on `appinstalled` and read on load) instead of relying
   on session-only state.
   _Value: Low · Importance: Low · Type: UI / Polish_

13. Create more icons. `src/lib/itemIcons.js`'s `MAP` currently maps
    ~500 of the 710 `COMMON_ITEMS` catalogue entries to a drawn icon —
    the rest fall back to the plain first-letter badge in grid view.
    Incremental, no-risk work: pick a base/glyph shape from the existing
    library (or draw a new one) and add `MAP` entries for the remaining
    ~200 items.
    _Value: Low · Importance: Low · Type: Content / Polish_

6. Create a proper viewing window for desktop. Today the layout is
   deliberately mobile-first with a fixed `max-width: 480px` centered
   column at any viewport size (`src/index.css:34`) — a past decision
   documented in Done below chose this over a separate desktop layout.
   Revisiting it means an actual desktop design (wider content, maybe a
   two-pane or sidebar layout), not just raising the cap; low priority
   since this is a 2-person app used mostly on phones.
   _Value: Low · Importance: Low · Type: UI / Layout_

16. Move all completed items to Todo_done.md. Expose the item numbers so they can be viewed through md, and sort the items.



## Done
- [x] In the meal planner, the "Endre"/"Legg til" button on today's card
      was hard to read in both light and dark mode. Root cause: today's
      card flips to an inverse surface (`background: var(--md-inverse-
      surface)`, `color: var(--md-inverse-on-surface)` in `MealsTab.jsx`),
      but `Button`'s `outline` variant hardcoded `color: var(--text-
      primary)` / `border: var(--border-strong)` — tokens tied to the
      *ambient* theme, not the inverse one. Fixed with a per-instance
      style override on today's button using the matching inverse tokens.
      Verified visually in both color schemes via a local wrangler-dev +
      Vite dev-proxy session. (1.22.4)
- [x] Bug: switching between grid and list view changed what "Nylig
      kjøpt" showed, not just how it was laid out — the section capped at
      9 items in grid view (3×3) vs. 3 in list view. Unified to a single
      view-independent cap (`BOUGHT_CAP = 9` in `ShoppingListTab.jsx`) so
      toggling the view only changes layout now, confirmed identical item
      sets in both views via a local visual check. (1.22.4)
- [x] Meal planner week view: non-today day cards are now more compact
      (`Card`'s `padding="sm"` instead of the default `md`, tighter title
      margin, smaller inter-card gap in the mobile stacked layout) so the
      week takes less vertical space overall. Today's card keeps its
      full-size prominent treatment; fitting the entire week without any
      scrolling on every device would need a larger layout rework, not
      attempted here. (1.22.4)
- [x] In Settings, "Install Panhandle" should be on top. `PwaInstallCTA`
      currently renders second in `SettingsTab.jsx`, after `ProfileIsland`'s
      identity/theme card, both under the "Meg & min app" island label.
      Moving it above `ProfileIsland` (or above the island label entirely) is
      a small JSX reorder, not a redesign.
- [x] Users can send feedback from the app (Settings → "Send
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
- [x] The landing page's shopping-list mockups (`public/index.html`) showed
      a stale UI pattern — per-category header rows (e.g. "Kjøtt og fisk",
      "Meieriprodukter") above groups of items — that the real app no
      longer has; unbought items render as one flat, aisle-sorted list/grid
      with no category dividers since the shopping list's category-section
      removal. Removed the fake headers from both the list-view and
      grid-view mockups; "Nylig kjøpt" keeps its own label since that
      section is still real. Kept as hand-coded CSS mockups rather than
      switching to real captured screenshots — no build step needed,
      matches how the section already worked. (1.21.2)
- [x] Let the super-admin delete a user account outright (Settings →
      Administrasjon → "Alle brukere" → "Slett", superadmin-only). New
      `DELETE /admin/users/{u}`, gated by `is_admin` + `isSuperAdmin` (same
      double-gate as `GET /admin/metrics`). Refuses (doesn't cascade) if the
      target is the last admin site-wide or the last owner of their list,
      mirroring `PATCH /admin/users/{u}/flags`'s existing guards. (1.21.1)
- [x] Let a user delete their own account (Settings → Profile → "Slett
      konto"), phase 1 of the account-lifecycle item — still one list per
      user. A non-owner (or an owner with a co-owner) just leaves; the
      list's last/sole owner cascade-deletes the entire list (shopping list,
      meal plan, catalogue, recurring schedule, every other member's
      account too) rather than being refused, since there's no "reassign
      ownership" flow yet. New `DELETE /account`, same current-password +
      IP-throttle pattern as `/change-password`/`/change-email`. "Exist
      without a list" / multi-list membership stays open as a future phase.
      (1.21.0)
- [x] The recurring meal responsibility section in Settings (`RecurringIsland.jsx`)
      is now minimizable — wrapped in the same `AccordionRow` already used by
      `MembersIsland`'s/`AdminIsland`'s/`ProfileIsland`'s sub-sections, instead
      of always being fully expanded (it previously had an explicit "no
      accordion" design note). Defaults to open, so nothing changes at first
      glance. `HomeIsland.jsx`'s manual divider between `MembersIsland` and
      `RecurringIsland` was removed since `AccordionRow` now supplies its own
      top border, matching how `MembersIsland`'s own two accordions are
      separated. (1.20.3)
- [x] iOS compatibility pass: added an `apple-touch-icon` (`app.html` and
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
- [x] The landing page's "Registrer deg" button opened a static "we're in
      closed beta, contact Mohibb" modal — a leftover from before
      self-service signup shipped (1.20.0). It now links straight to the
      real signup screen (`/app.html?signup=1`, a new query param
      `AuthScreens.jsx` reads alongside its existing `reset_token`
      handling); the dead modal markup/CSS/JS in `public/index.html` was
      removed. The in-app login screen's own "Opprett ny husstand" button
      was already correctly wired to the signup flow and needed no change.
      (1.20.1)
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
