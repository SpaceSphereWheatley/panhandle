# TODO

Open items, numbered and grouped by theme; within each group, sorted by
importance (highest-importance first, ties broken by value). Numbers are stable IDs for reference in
commits/discussion — don't renumber when items are completed, just strike
them and move to `Todo_done.md`; re-pack (renumber) only when the open list
gets sparse. Full "fixed in" details live in `CHANGELOG.md`, not here.
Completed items live in `Todo_done.md`, not below.

**Group priority** (highest to lowest, reassessed 2026-07-31):
1. **Bugs** — 4 low-priority latent/edge issues remain from the two QA/audit
   passes (2026-07-18, 2026-07-20): #87, #88, #89, #92. Everything else
   from both passes, plus #94 and #114, is fixed — see `Todo_done.md`.
2. **Backend/API design review (2026-07-31)** — a Senior-Backend-Architect
   pass over `worker/index.js`'s REST conventions, schema/query integrity,
   security/validation, reliability, and documentation (see `## Backend /
   API` below). Tenant isolation, auth, and error-code discipline all held
   up well; the concrete gaps are #130-#135, all low-urgency (an
   auth-boundary convention with no test guarding it, a check-then-act race
   on a purchase counter, a non-atomic multi-field PATCH, a missing index,
   an unbounded admin query, and no machine-readable API contract).
3. **UI/UX audit findings (2026-07-31)** — a fresh design-system/consistency/
   accessibility pass over every screen (see `## UI/UX` below). One real gap
   worth prioritizing above the rest: **#116** (removing a shopping-list item
   has no confirm and no undo — the app's single most common delete action,
   and the only one with no cancel path at all). #117-#124 are consistency/
   accessibility/polish. This pass also triaged `docs/ui-review-plan.md`,
   which predates the design-system rewrite and is now stale: its still-valid
   open items were carried over here (**#125, #126, #127**); the rest of its
   open items (U1, U6-U10, U15, U17, U19, U20) are either already shipped by
   the rewrite or superseded by it and can be treated as closed even though
   still unchecked in that file.
4. **Code quality / architecture review (2026-07-31, Principal-Engineer
   pass)** — a full-repo pass over `worker/index.js` and the React frontend
   for architecture, performance, and error-handling gaps (see `## Code
   quality` below). Nothing urgent: the concrete gaps are #136-#140, plus
   an explicitly optional/long-term idea (#141). Two worth calling out —
   **#139** (four separate hand-rolled copies of the same rate-limit
   check, `/login`/`/change-password`/`/change-email`/`DELETE /account`,
   instead of the shared helper every other rate-limited endpoint uses)
   and **#140** (the frontend's `api()` helper can throw uncaught on a
   malformed response, with at least one confirmed call site — catalogue
   load — that has no try/catch around it).
5. **Small UI/polish items — low value, low risk, good filler:**
   - **#5** Poll-interval backoff when idle (explicitly: don't do
     speculatively, only if load actually grows)
   - **#124** Minor icon/component consistency nits (see below)
6. **Multi-list data model (#1)** — high ceiling if this app ever needs
   more than one household/list, but nothing today needs it (still just
   2 users, 1 list) and it's a real schema/data-model change, not a small
   one. Correctly deferred; revisit only if a concrete second-list need
   shows up.

**Execution order** (cross-cutting sequencing pass, 2026-07-31 — bundles
items across the groups above by shared file/dependency rather than by
review-pass, to minimize context-switching. Group priority above still
governs anything not listed here):

1. **#116 + #121** — same file (`ItemEditModal.jsx`), ship together.
2. **#130** — pure test file, zero deploy risk, do anytime.
3. **#133** — trivial expand-only migration, no code change to adopt it.
4. **#87 + #88 + #89 + #92** — bug sweep, one PR.
5. **#131 + #132** — backend data-integrity batch, same file region as
   the bug sweep.
6. **#137** — real live bug (uncaught exception), ranks above the
   performance items in Code quality despite both being P2.
7. **#117 → #118 → #124** — strictly in this order: the shared button
   base (#118) must be built on top of the focus ring (#117), not
   retrofitted; #124 folds into the same pass.
8. **#119 + #122 + #123** — unrelated one-file fixes, batch to amortize
   version-bump/changelog overhead.
9. **#136 phase 1**, then — only after a full deploy cycle confirms all
   four endpoints are writing `rate_limit_attempts` correctly — **#136
   phase 2** (the `login_attempts` drop). Don't compress the two phases
   into one sprint.

Everything else (#120, #125, #126, #127, #134, #135, #138, #139, #140,
#115, #1, #5, and the `## Ideas` section) is deliberately not in this
sequence — see each item's own note for why, or the group priority
rationale above.

## Bugs

4 low-priority latent/edge bugs remain, found across two QA/audit passes
(2026-07-18 and 2026-07-20; file:line refs below are from those passes —
verify before fixing). Everything else from both passes, plus #94 and #114,
is fixed — see `Todo_done.md`.

### P2 — Low (latent / edge)

87. Toggle/delete list-item endpoints return `200 ok` for non-existent or
    other-list IDs (`/list/:id/toggle` ~L2204, `DELETE /list/:id` ~L2228) —
    the UPDATE/DELETE matches nothing and still reports success (no 404).
    Harmless (scoped by `list_id`) but masks client bugs.
    _Value: Low · Importance: Low · Type: Bug / API_

88. `responsible` is never validated against list membership — `/plan`
    (~L2423) and `/recurring` (~L2465) accept any string. Partly by design
    (free-text "Annet"), but a client could store an arbitrary username.
    _Value: Low · Importance: Low · Type: Bug / Meals_

89. Recurring-default weekday uses a local `getDay()` on a UTC-parsed date.
    `MealPlanModal.jsx` (~L57) does `new Date(iso).getDay()` — `iso` parses as
    UTC midnight but the weekday is read locally, so the prefilled recurring
    responsible is off-by-one for users west of UTC. Non-issue for a
    Norway-only app; latent correctness bug.
    _Value: Low · Importance: Low · Type: Bug / Date handling_

92. `renameUsername` (`worker/index.js` ~L1039) cascades a username rename
    across 6 tables but not `list_presence.username` (a by-value username copy,
    ~L2101). Harmless because presence rows age out in ~20s and a fresh row is
    written on the next poll, but it breaks the function's "update every
    by-value copy" invariant. Add it to the batch, or leave an explicit
    "ephemeral, intentionally skipped" comment.
    _Value: Low · Importance: Low · Type: Bug / Data consistency_

## Backend / API

From a Senior-Backend-Architect-style review (2026-07-31) of `worker/index.js`
against REST conventions, schema/query integrity, security/validation,
reliability/edge cases, and documentation. Tenant isolation (every mutating
query scoped `WHERE id = ? AND list_id = ?`), the JWT/`token_version`
revocation model, and the code-driven error-code contract all held up well —
these are the concrete gaps found.

### P2 — Reliability / data integrity

130. **Auth boundary is enforced only by file position, not code.** Every
     route below the `// ===== AUTH REQUIRED BELOW =====` marker
     (`worker/index.js` ~L2009) is authenticated purely by being written
     after that comment — nothing stops a new route from accidentally
     landing above it and shipping unauthenticated. Add a regression test
     asserting the fixed whitelist of public routes (`/version`, `/login`,
     `/register`, `/auth/google`, `/forgot-password`, `/reset-password`,
     `/invite-signup`, `/invite-google`, `GET /list-invites/:token`,
     `GET /calendar/:token.ics`) are the only route checks appearing before
     that marker's line number — same drift-guard pattern as
     `dictionaries.test.js`.
     _Value: Medium · Importance: Low · Type: Bug / Security hardening_

131. **`POST /list/:id/toggle` has a check-then-act race on
     `item_catalogue.times_bought`.** It reads `bought` in a `SELECT`, then
     bumps the purchase counter in a separate statement based on that stale
     read (~L2848-2874). Two concurrent toggles of the same item (two
     housemates tapping "bought" within the same poll window) can both
     observe `bought = 0` and both increment the counter for one real
     transition, corrupting the average-purchase-interval stat
     `GET /catalogue/suggestions` depends on. Fix: drive the counter bump off
     the flip `UPDATE`'s own `RETURNING` result instead of the pre-read.
     Needs a test alongside the fix — nothing currently guards this: a unit
     test asserting two concurrent toggles of the same item only bump the
     counter once.
     _Value: Low · Importance: Low · Type: Bug / Data consistency_

132. **`PATCH /list/:id` isn't atomic.** Up to 5 sequential `UPDATE`
     statements for one logical edit (~L2795-2831), no `env.DB.batch()`. A
     dropped connection between statements leaves the item half-updated with
     no way for the client to tell which fields actually landed.
     _Value: Low · Importance: Low · Type: Reliability / API_

### P3 — Scale / documentation

133. **Missing index on `users.email`.** `username` is the PK, but
     login-by-email, `/forgot-password`, `/auth/google`, and every
     duplicate-email check filter on `email = ?1` directly with no index on
     that column (unlike `google_sub`, which got a unique partial index in
     `0010_signup_and_recovery.sql`) — a full table scan on every one of
     those requests. Cheap, additive migration:
     `CREATE INDEX idx_users_email ON users(email COLLATE NOCASE)`.
     _Value: Medium · Importance: Low · Type: Performance / Schema_

134. **`GET /admin/metrics`'s `per_list` query is unbounded.** Three
     correlated subqueries per row, over every list in the DB, no
     pagination — the one query in the app whose cost scales with total
     tenants rather than one household's data. Fine at current scale; worth
     a `LIMIT`/cursor before Play Store publishing drives real growth.
     _Value: Low · Importance: Low · Type: Performance / Scalability_

135. **No machine-readable API contract.** ~70 routes, and the entire
     contract lives in prose (`CLAUDE.md`) and inline comments — fine for
     the sole maintainer today, a landmine for any future integration beyond
     the read-only ICS feed. A `docs/api-reference.md` table
     (method/path/auth level/notes), diffed in CI against the route list the
     way `dictionaries.test.js` guards i18n drift, would get most of the
     value without a new hand-maintained source of truth.
     _Value: Low · Importance: Low · Type: Documentation_

## UI/UX

From a full UI/UX audit (2026-07-31) covering the design system, both tabs,
every Settings subpage, auth screens, and ~15 modals — cross-checked against
`docs/ui-review-plan.md`, which predates the Vite/design-system rewrite and is
now stale (see the group-priority note above for how its still-open items
were triaged).

### P1 — Correctness / trust

116. **No confirm or undo when removing an item from the list.**
     `ItemEditModal.jsx`'s `removeFromList` (the full-width red "remove from
     list" button) deletes immediately — no `confirm()`, no undo toast. It's
     the only single-item delete in the app that isn't gated: `deleteFromCatalogue`
     two lines below it, meal/plan-day delete, member removal, admin user
     delete, and invite/calendar-feed revoke all go through `useConfirm()`
     first. Add a confirm dialog, or an undo toast (matching the "plan again"
     pattern already used in `MealsTab.jsx`'s `planAgain`).
     _Value: High · Importance: High · Type: Bug / UX / Data safety_

117. **No `:focus-visible` styling anywhere in the app.** A full-repo grep
     turns up zero `:focus`/`:focus-visible` rules in any CSS or inline style.
     Every interactive element is a React inline-style component, so a
     keyboard/switch-control user gets no visual focus indication anywhere.
     Needs a shared focus ring that the design-system components (and the
     one-off buttons in #118) can all opt into — inline `style` objects can't
     express the pseudo-class directly, so this likely means a shared CSS
     class in `base.css` plus each component applying it. Supersedes
     `docs/ui-review-plan.md` U3 (never actually fixed, despite predating the
     rewrite).
     _Value: High · Importance: High · Type: Bug / Accessibility_

### P2 — Consistency & accessibility polish

118. **Two button systems.** `Button`/`IconButton`/`Fab` implement careful
     hover/press/ripple state layers, but a large share of real controls
     bypass them with raw, hand-styled `<button>` elements that get none:
     `MealsTab.jsx`'s week-nav arrows/"this week"/"Alle måltider ›"/density
     toggle, `ShoppingListTab.jsx`'s view toggle/important-chip/"Recently
     bought" collapse, `StoreSubpage.jsx`'s reorder up/down buttons,
     `Header.jsx`'s back arrow. None of these give any visual feedback on tap.
     Factor a shared low-level button base (radius/padding/press-state) that
     both the design-system components and these one-off controls go through.
     Do in this order (must land after #117 — the base should be built with
     the focus ring, not retrofitted): (a) decide the primitive's prop shape
     (variant/size/press-state) before any call site is migrated, so the four
     migrations below don't each improvise a different shape; (b) migrate
     `MealsTab.jsx`'s controls; (c) migrate `ShoppingListTab.jsx`'s controls;
     (d) migrate `StoreSubpage.jsx`'s reorder buttons + `Header.jsx`'s back
     arrow. Supersedes `docs/ui-review-plan.md` U6/U7/U10.
     _Value: Medium · Importance: Medium · Type: UI consistency_

119. **Hardcoded Norwegian text in a fully-i18n'd app.** `Spinner.jsx`'s
     `aria-label="Laster"` and `LoadingState`'s default `label = 'Laster...'`
     never go through `t()`. Four modals (`MealPlanModal`, `IngredientPickerModal`,
     `WeekIngredientsModal`, `MealCatalogueBrowseModal`) call `<LoadingState />`
     with no override, so an English-language device briefly shows
     "Laster..." during every one of those loads.
     _Value: Low · Importance: Medium · Type: Bug / i18n_

120. **Swipe-to-mark-important and long-press-to-edit are entirely
     undiscoverable.** Both gestures are implemented (`ItemCard.jsx`) and
     explained in `ImportantInfoModal` — but only once a user finds the small
     legend trigger next to the header. The onboarding tour
     (`onboardingSlides.js`) never mentions either gesture. Add a one-time
     coach-mark, or fold a slide into onboarding. **Needs a decision before
     scheduling** — the two options aren't equivalent effort (a coach-mark is
     a new one-off component; a slide reuses `OnboardingFlow`'s existing
     mechanism but only reaches first-run devices, not existing users) — pick
     one before pulling this into a build wave. Supersedes
     `docs/ui-review-plan.md` U15.
     _Value: Medium · Importance: Low · Type: UX / Discoverability_

121. **Severity ordering is inverted in `ItemEditModal`.** "Remove from list"
     (reversible — the catalogue entry survives) is a bold full-width danger
     `Button`; "Forget completely" (irreversible — cascades and deletes
     purchase history) is a 12px muted underlined text link below it. Swap
     the visual weight so the more destructive action reads as more serious,
     not less.
     _Value: Low · Importance: Low · Type: UI consistency_

122. **`SuggestionsModal` has no neutral close button.** Its only footer
     action is "add something else," which closes the modal *and* focuses
     the add-item input — there's no plain "Close," unlike every sibling
     browse/info modal (`ChangelogModal`, `ImportantInfoModal`,
     `MealCatalogueBrowseModal`).
     _Value: Low · Importance: Low · Type: UI consistency_

123. **No confirm-password field on change-password.** `AccountSubpage.jsx`
     still takes only a single ≥8-char new-password field — a typo locks the
     user out until an admin resets it. Add a confirm field (optionally a
     strength hint). Carried over from `docs/ui-review-plan.md` U19.
     _Value: Medium · Importance: Low · Type: UX / Forms_

124. **Minor consistency nits — bundle as filler.** Two icon call conventions
     coexist (`<UiIcon name="x">` vs. raw `<i className="ph ph-x">` inline
     elsewhere); `Checkbox`/`Switch`/`Tag` each hand-roll their own radius/
     press treatment rather than sharing one base. Cosmetic; fold into
     whichever pass picks up #118.
     _Value: Low · Importance: Low · Type: UI polish_

### P3 — Carried over from `docs/ui-review-plan.md` (still valid)

125. **Fonts still load render-blocking from Google Fonts.** `app.html` and
     every `public/*.html` page `<link>` to `fonts.googleapis.com` for
     Instrument Sans + Caveat. Self-hosting removes a third-party dependency,
     speeds first paint, and helps the offline story (the service worker
     can't cache a cross-origin stylesheet it doesn't control). Carried over
     from `docs/ui-review-plan.md` U14 (originally written about Roboto —
     the typeface changed since, the gap didn't).
     _Value: Low · Importance: Low · Type: Performance_

126. **Admin "Alle brukere" groups by raw list id, not a human label.**
     `AdminSubpage.jsx` still renders `t("settings.admin.allUsers.group", {
     listId, count })` → "List {listId} · N users" — no owner name or
     nickname. Carried over from `docs/ui-review-plan.md` U22.
     _Value: Low · Importance: Low · Type: UI polish / Admin_

127. **Nudge admin-created/reset accounts to change their seeded password.**
     `createOwner`/`resetPassword` in `AdminSubpage.jsx` hand back a
     plaintext password via `CredentialsModal`, but nothing afterward prompts
     that account to actually change it. Carried over from
     `docs/ui-review-plan.md` U23.
     _Value: Low · Importance: Low · Type: UX / Security hygiene_

## Code quality

From a Principal-Engineer-style code quality/architecture review (2026-07-31)
of `worker/index.js` and the React frontend, covering separation of concerns,
performance/re-render behavior, and error handling. No urgent bugs — the
gaps below are cost-of-change/robustness risks confirmed directly against
the current code (not the older commit the review started from — line refs
were re-verified after `main` moved).

### P2 — Correctness / robustness

136. Two more `login_attempts` rate-limit copies than the review first found:
     it's not just `/login` and `/change-password` (~L1627-1651,
     ~L2025-2047) hand-rolling the same inline
     `SELECT COUNT(*) FROM login_attempts WHERE ip=? AND created_at>=?` +
     manual prune — `/change-email` (~L2085-2106) and `DELETE /account`
     (~L2139-2155) do too, all four independently, instead of calling the
     shared `checkRateLimit`/`recordAttempt` helpers (`rate_limit_attempts`
     table) that `/register`, `/forgot-password`, `/feedback`, and invite
     redemption already use. Four copies with no test guarding they stay in
     sync (unlike `shared/errorCodes.js`'s equivalent contract) is a real
     drift risk. Migrate all four onto `checkRateLimit`/`recordAttempt`
     (kinds `"login"`, `"change_password"`, `"change_email"`,
     `"delete_account"` — check these don't collide with the existing
     `"register"`/`"forgot_password"`/`"feedback"`/`"invite_redeem"` kinds
     before shipping), then drop the `login_attempts` table in a follow-up
     contract migration. Two-phase, don't compress: ship the migration onto
     the shared helper first, confirm all four endpoints are writing
     `rate_limit_attempts` correctly through one full deploy cycle, *then*
     drop the old table.
     _Value: Medium · Importance: Low · Type: Bug / Maintainability_

137. `src/lib/api.js`'s `api()` helper has no handling for a non-JSON or
     unexpected-status response — for any status other than 401 it
     unconditionally does `return res.json()`, which throws uncaught for a
     malformed body (e.g. an origin 500 HTML error page). Confirmed live
     gap: `loadCatalogue()` in `ShoppingListTab.jsx` (~L238-240, called via
     `loadCatalogue().then(loadList).finally(...)` at ~L309) has no
     `try/catch`, so a bad `/catalogue` response silently leaves the
     catalogue stale/empty for the rest of the session with no user-visible
     error. Make `api()` defensively parse JSON and throw a clear,
     catchable error; audit call sites missing a catch.
     _Value: Medium · Importance: Medium · Type: Bug / Frontend_

### P3 — Performance (no measured user impact yet, but easy to get right)

138. No `React.memo` anywhere in the frontend (repo-wide grep confirms
     zero uses). `ItemCard.jsx` (framer-motion-driven, several
     `useMotionValue`/`useTransform` hooks) re-renders on every item in the
     list on every 7s poll tick, since `loadList()`'s `setItems(fetched)`
     (`ShoppingListTab.jsx` ~L264) always swaps in a fresh array reference
     regardless of whether the data changed, and `renderItems()` (~L1190)
     passes `onToggle`/`onToggleImportant`/`onEdit` as bare,
     non-`useCallback`'d functions. Wrap `ItemCard` in `React.memo`,
     stabilize those callback props with `useCallback`, and skip
     `setItems` when the fetched payload is unchanged.
     _Value: Medium · Importance: Low · Type: Performance / Frontend_

139. Every context Provider (`AuthContext`, `ListUsersContext`,
     `CategoryOrderContext`, `RecurringContext`, `PushContext`,
     `ToastContext`, `InstallPromptContext`; `LanguageContext` partially —
     it memoizes `t` but not the provider's own value object) passes a
     fresh inline `value={{...}}` on every render. `AuthContext` wraps the
     whole app and re-renders on nearly every request (the sliding-expiry
     token refresh calls `setAuth`), cascading re-renders through every
     consumer below it. Memoize each provider's value (and the callbacks it
     hands out).
     _Value: Medium · Importance: Low · Type: Performance / Frontend_

140. `mintToken` (`worker/index.js` ~L2010-2012) signs a brand-new JWT on
     *every* authenticated request, including plain GETs, despite a 90-day
     token lifetime (~L1112) — unconditional HMAC signing plus an
     `X-Refresh-Token` write and a client-side `localStorage` write, on
     every 7s poll tick from every open tab. Only mint a refresh token when
     the current one is within some fraction of its expiry (e.g. <50% TTL
     remaining) instead of unconditionally.
     _Value: Low · Importance: Low · Type: Performance / Backend_

## Data model / Account lifecycle

1. Let a user exist without a list, and let anyone create lists, be members
   of multiple lists, and choose between them (phase 2 of the account-
   lifecycle item — phase 1, self-delete under the one-list-per-user model,
   shipped in 1.21.0). Every user today is still tied to exactly one
   `list_id` (see CLAUDE.md's multi-tenant model); this phase is the actual
   data-model change (nullable list membership, an N:N user↔list join
   instead of a single FK, a "choose/create list" UI) that phase 1
   deliberately deferred.
   _Value: High · Importance: Low · Type: Data model / Account lifecycle_

## Performance

5. Poll interval is a fixed 7s with no backoff when the tab is idle (no
   interaction for a while) but visible. At 2 users on D1 this costs
   nothing today — only worth doing once user count or request volume
   actually grows, and it trades off responsiveness (stale data right
   after returning from idle) for load savings, so don't add it
   speculatively.
   _Value: Low · Importance: Low · Type: Performance_

## Ops

115. Set up a `feedback@panhandle.app` alias (Cloudflare Email Routing on the
     already-Resend-verified `panhandle.app` zone, forwarded to the personal
     inbox `FEEDBACK_EMAIL` points at) and add it as a Gmail "Send mail as"
     alias, so replies to user feedback show the alias instead of the real
     personal address. Dashboard-only setup, no code change; optionally also
     repoint `FEEDBACK_EMAIL` at the alias instead of the raw personal
     address.
     _Value: Medium · Importance: Low · Type: Ops / Privacy_

## Ideas (unvetted)

Raw suggestions from the 2026-07-20 app-audit — **not** accepted work like the
items above, and not yet weighed against effort/appetite. Promote an idea into
a real section (Feature / Data model / …) once it's actually decided on; delete
the ones that don't earn their keep. Keep the same stable-ID discipline.

_High value, low effort:_

101. Quantity stepper on the item card (subtle +/- or long-press) so the common
     "need 2, not 1" adjustment doesn't require opening the edit modal.
     _Value: Medium · Importance: Low · Type: Idea / Shopping list_

109. Wire up the bottom-sheet drag-grabber to actually dismiss on drag. The
     grabber pill (`Sheet.jsx`) is currently a static visual affordance with no
     touch/drag handler behind it — swiping down on it does nothing, which
     misleads users familiar with the iOS/Android bottom-sheet convention.
     `framer-motion`'s `drag="y"` with a dismiss threshold (already a
     dependency, used elsewhere for `Reorder`/swipe gestures) would wire it up;
     desktop's `dialog` placement has no grabber and needs no change.
     _Value: Medium · Importance: Low · Type: Idea / UI polish_

_Exploratory / higher ceiling:_

107. Pantry / "have at home" state to suppress suggestions for staples you keep
     stocked, complementing the current overdue-interval suggestions.
     _Value: Low · Importance: Low · Type: Idea / Shopping list_

108. Seed new lists from a shared `seed_catalogue` table (copy-on-create)
     instead of the 710-entry `COMMON_ITEMS` array duplicated between
     `worker/index.js` and migrations 0002/0003 — kills a documented drift
     hazard. Refactor, not a user-facing feature.
     _Value: Low · Importance: Low · Type: Idea / Refactor_

_Carried over from `docs/ui-review-plan.md` (2026-07-31 UI/UX audit):_

128. "Shopping mode" — hide bought items, large high-contrast text, keep-
     screen-awake, tuned for actually walking the store. Carried over from
     `docs/ui-review-plan.md` U25.
     _Value: Medium · Importance: Low · Type: Idea / Shopping list_

129. Multi-week / month meal-plan overview, for planning past the current
     one-week strip (`weekOffset` is still clamped `[WEEK_MIN, WEEK_MAX]` =
     `[-1, 4]`). Carried over from `docs/ui-review-plan.md` U27.
     _Value: Low · Importance: Low · Type: Idea / Meals_

141. Replace `worker/index.js`'s ~50+ sequential
     `if (path === X && method === Y)` route checks (from the 2026-07-31
     code quality review — see `## Code quality`) with a plain object
     dispatch table (`{ "GET /list": handler, ... }`) — same handler
     bodies, no new dependency/framework, just an object lookup instead of
     a linear scan. Explicitly optional/long-term: the current shape is a
     deliberate, documented trade for a solo dev without a framework (see
     CLAUDE.md), and the existing extract-pure-logic-and-unit-test pattern
     already mitigates its worst downside (untestable handlers). Only
     worth doing if route count keeps growing.
     _Value: Low · Importance: Low · Type: Idea / Refactor_

## Done

See `Todo_done.md`.
