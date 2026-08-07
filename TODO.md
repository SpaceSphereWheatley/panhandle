# TODO

Open items, numbered and grouped by theme; within each group, sorted by
importance (highest-importance first, ties broken by value). Numbers are stable IDs for reference in
commits/discussion — don't renumber when items are completed, just strike
them and move to `Todo_done.md`; re-pack (renumber) only when the open list
gets sparse. Full "fixed in" details live in `CHANGELOG.md`, not here.
Completed items live in `Todo_done.md`, not below.

**Group priority** (highest to lowest, reassessed 2026-07-31):
1. **Bugs** — the two QA/audit passes (2026-07-18, 2026-07-20) are now fully
   closed out: #87, #88, #89, #92 (the last low-priority latent/edge issues)
   plus everything else from both passes, plus #94 and #114, are all fixed —
   see `Todo_done.md`.
2. **Backend/API design review (2026-07-31)** — a Senior-Backend-Architect
   pass over `worker/index.js`'s REST conventions, schema/query integrity,
   security/validation, reliability, and documentation (see `## Backend /
   API` below). Tenant isolation, auth, and error-code discipline all held
   up well; the concrete gaps are #131, #132, #134, #135, all low-urgency
   (a check-then-act race on a purchase counter, a non-atomic multi-field
   PATCH, an unbounded admin query, and no machine-readable API contract).
   #130 (the auth-boundary drift guard) is fixed, and #133 (a suspected
   missing index on `users.email`) turned out to already be indexed and
   in use — see `Todo_done.md`.
3. **UI/UX audit findings (2026-07-31)** — a fresh design-system/consistency/
   accessibility pass over every screen (see `## UI/UX` below). #116
   (removing a shopping-list item had no confirm and no undo), #117 (the
   backlog's only P1 — no `:focus-visible` styling anywhere in the app),
   #118 (one-off buttons with no press feedback), and #124 (icon/component
   consistency nits) are all fixed — see `Todo_done.md`. #119-#123,
   #125-#127 are the remaining consistency/accessibility/polish gaps. This
   pass also triaged `docs/ui-review-plan.md`,
   which predates the design-system rewrite and is now stale: its still-valid
   open items were carried over here (**#125, #126, #127**); the rest of its
   open items (U1, U6-U10, U15, U17, U19, U20) are either already shipped by
   the rewrite or superseded by it and can be treated as closed even though
   still unchecked in that file. A follow-on **interaction-consistency pass
   (2026-08-05)** over gestures, motion, haptics and in-flight state added
   **#145-#151** to the same section: the modal layer, `FabMenu` and the
   `useIsDesktop()` switches all held up as genuinely shared, but
   per-row/per-card interaction was built independently per tab — Storage
   is outside the motion system entirely, Meals and Storage are silent to
   the touch, and long-press-to-edit only ever worked on the shopping list.
   **#148** (three modals with no double-submit guard) is the only real bug
   in that batch and is sequenced with the other bugs, not with the polish.
4. **Code quality / architecture review (2026-07-31, Principal-Engineer
   pass)** — a full-repo pass over `worker/index.js` and the React frontend
   for architecture, performance, and error-handling gaps (see `## Code
   quality` below). Nothing urgent: the concrete gaps are #136-#140. Two
   worth calling out — **#139** (four separate hand-rolled copies of the same rate-limit
   check, `/login`/`/change-password`/`/change-email`/`DELETE /account`,
   instead of the shared helper every other rate-limited endpoint uses)
   and **#140** (the frontend's `api()` helper can throw uncaught on a
   malformed response, with at least one confirmed call site — catalogue
   load — that has no try/catch around it).
5. **Small UI/polish items — low value, low risk, good filler:**
   - **#5** Poll-interval backoff when idle (explicitly: don't do
     speculatively, only if load actually grows)
6. **Multi-list data model (#1)** — high ceiling if this app ever needs
   more than one household/list, but nothing today needs it (still just
   2 users, 1 list) and it's a real schema/data-model change, not a small
   one. Correctly deferred; revisit only if a concrete second-list need
   shows up.

**Execution order** (cross-cutting sequencing pass, 2026-07-31, bundling
items across the groups above by shared file/dependency rather than by
review-pass, to minimize context-switching; **reordered 2026-08-05** to lead
with value/importance instead of file-locality alone — the original pass put
step 3 (#117's chain) behind a Low/Low backend batch, which meant the
backlog's only P1 item and its two Medium-rated reliability bugs would've
waited behind its two lowest-priority items for no dependency reason. Group
priority above still governs anything not listed here. Steps 1-2 of the
original 2026-07-31 pass — #116 + #121 and #130 — shipped in #265; step 3,
#133, turned out to already be fixed; step 4 (formerly #87 + #88 + #89 +
#92) shipped as the bug sweep (see `Todo_done.md`); step 1 of this
2026-08-05 reorder — #117 → #118 → #124 — shipped in #292; renumbered
below):

1. **#137 + #148** — the two real reliability bugs, batched: an uncaught
   exception on a malformed response, and three editor modals with no
   double-submit guard. Both rank above the performance items in Code
   quality despite all being P2.
2. **#149 → #147** — strictly in this order. #149 (one shared `MotionCard`)
   must land before #147 (wiring Storage into the motion system), or #147
   creates a third copy of the thing #149 exists to remove.
3. **#145 + #146 + #150 + #151** — the gesture/haptic/desktop-gate batch.
   Kept contiguous with step 2 because it lands in the same files that pass
   leaves hot (`MealsTab.jsx` especially). #151 is the write-up of what
   #145 settles, so it goes last in the batch, not first.
4. **#119 + #122 + #123** — unrelated one-file fixes, batch to amortize
   version-bump/changelog overhead.
5. **#131 + #132** — backend data-integrity batch. Both Low/Low — nothing
   else depends on these landing earlier.
6. **#136 phase 1**, then — only after a full deploy cycle confirms all
   four endpoints are writing `rate_limit_attempts` correctly — **#136
   phase 2** (the `login_attempts` drop). Don't compress the two phases
   into one sprint.

Everything else (#120, #125, #126, #127, #134, #135, #138, #139, #140,
#142, #143, #144, #115, #1, #5) is deliberately not in this sequence —
see each item's own note for why, or the group priority rationale above.
Note #120 and #143 both become easier calls once step 3 lands: #120
(gesture discoverability) is worth revisiting once long-press actually
works app-wide, and #143 (success toasts) is already pointed at the
button-system pass that shipped in #292.

## Backend / API

From a Senior-Backend-Architect-style review (2026-07-31) of `worker/index.js`
against REST conventions, schema/query integrity, security/validation,
reliability/edge cases, and documentation. Tenant isolation (every mutating
query scoped `WHERE id = ? AND list_id = ?`), the JWT/`token_version`
revocation model, and the code-driven error-code contract all held up well —
these are the concrete gaps found.

### P2 — Reliability / data integrity

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

### P2 — Consistency & accessibility polish

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
     `docs/ui-review-plan.md` U15. **Revisit after #145** — once long-press
     opens the editor on meal and storage cards too, it stops being a
     shopping-list-only trick and becomes one app-wide gesture worth
     teaching, which tilts the decision toward the onboarding slide (one
     lesson, one mechanism) over a per-tab coach-mark.
     _Value: Medium · Importance: Low · Type: UX / Discoverability_

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

### Storage module polish (from the 2026-08-04 UX/UI audit, #1-#5 fixed same pass)

143. **No success toast on box save/delete.** Saving or deleting a box in
     `BoxEditModal.jsx` only closes the modal and reloads the list — errors
     toast, success doesn't. Matches `ItemEditModal`/`MealEditModal`'s
     existing pattern app-wide, so fixing it in Storage alone would be
     inconsistent; revisit as an app-wide decision now that #118's
     button-system consolidation has shipped (#292).
     _Value: Low · Importance: Low · Type: UX / Consistency_

144. **No shared `Banner`/`Callout` primitive for one-off informational
     banners.** `StorageTab.jsx`'s former "early preview" banner (a sunken
     surface with an accent left-rule, since removed now that the module is
     ungated — see `CHANGELOG.md`) was a fully bespoke inline-styled block
     with nothing else in the app to compare it against. If a future screen
     needs a persistent info/beta banner, factor a shared component instead
     of copy-pasting the inline styles again.
     _Value: Low · Importance: Low · Type: UI polish / Consistency_

### Interaction consistency (from the 2026-08-05 gesture/UX audit)

A pass over gestures, motion, haptics and in-flight state across all four
tabs, Settings, and the modal layer. The *chrome* turned out to be genuinely
unified — all ~23 modals route through the one `Modal.jsx`→`Sheet.jsx` pair
(identical open/close, drag-to-dismiss, Cancel/Save placement), `FabMenu` is
the same component with the same position/animation/haptics in all three
tabs that have one, and every desktop/compact structural switch really does
go through `useIsDesktop()`. What diverges is per-row/per-card *interaction*,
which was designed independently per tab. Items below are ordered by how
much a user actually feels them.

Two decisions were taken up front, and the items assume both:

- **Shopping's row-tap stays a bought/unbought toggle** (it's a check-off
  surface — tapping to open an editor would be wrong there), even though
  Meals and Storage open their editor on tap. The divergence is deliberate
  and gets documented rather than converged (#151), not treated as a defect.
- **Long-press is the app-wide "open this thing's editor" gesture, and no
  new swipe gestures are added.** The three existing drag implementations
  (`ItemCard`'s horizontal important-swipe, `MealsTab`'s week-pager,
  `StoreSubpage`'s `Reorder` handle) each serve a genuinely different task
  and stay as they are; no shared swipe abstraction is worth building for
  three one-offs that share only boilerplate.

145. **Long-press-to-edit exists only on the shopping list.**
     `useLongPress` (`src/hooks/useLongPress.js`, 500ms, 10px move
     tolerance, already suppresses the trailing synthetic click and already
     fires `haptic()` itself) is imported by exactly one component in the
     app — `ItemCard.jsx`. A user who learns hold-to-edit in Shopping finds
     it dead on a meal day card or a storage box. Attach the same hook to
     `MealsTab.jsx`'s day cards and `StorageTab.jsx`'s `BoxCard`, opening
     the same editor their tap already opens. Deliberately redundant with
     tap there: the point is that the gesture never *fails*, not that it's
     the only route. Pure addition — no existing behaviour changes.
     _Value: Medium · Importance: Medium · Type: UX / Gesture consistency_

146. **Meals and Storage are almost entirely silent to the touch.** Both
     tabs import `haptic` (`MealsTab.jsx:9`, `StorageTab.jsx:7`) and each
     uses it in exactly one place: passing it to `FabMenu`
     (`MealsTab.jsx:734`, `StorageTab.jsx:276`). So the only vibration
     anywhere in either tab is opening the FAB or picking an item from it —
     planning a meal, deleting a meal, saving a box, deleting a box and
     scanning a QR code are all silent, while the shopping list buzzes on
     add, toggle, important, swipe-commit, long-press, ping and
     mark-all-bought. Fire `haptic()` at the write-completion points in
     both tabs to match. #145 supplies the long-press half of this for
     free. Note `haptic()` is already user-gated (`ph_haptics`), so no new
     setting is needed.
     _Value: Medium · Importance: Medium · Type: UX / Consistency_

147. **The Storage module sits entirely outside the motion system.**
     Neither `StorageTab.jsx` nor any file in `src/components/storage/`
     imports framer-motion or `useMotionConfig` (repo-wide grep confirms).
     Box cards use the plain `Card` unconditionally, so adding, deleting or
     filtering a box pops with no enter/exit transition, and the
     Appearance design-intensity setting has literally nothing to turn off
     there — unlike Shopping and Meals, which both thread `shouldAnimate`
     through to their cards. Wire `useMotionConfig()` into `StorageTab` and
     give the box list the same `AnimatePresence` + `shouldAnimate ?
     MotionCard : Card` treatment the other two tabs use. Depends on #149
     landing first, so this consumes the shared primitive rather than
     adding a third copy of it.
     _Value: Medium · Importance: Low · Type: UI consistency / Motion_

148. **Only one of the four editor modals guards against a double-submit.**
     `BoxEditModal.jsx` tracks `saving`/`deleting`, disables
     Save/Delete/Cancel and swaps in a progress label while the request is
     in flight (shipped in 1.61.0). `ItemEditModal`, `MealPlanModal` and
     `MealEditModal` have no such guard, so a double-tap on a slow
     connection submits twice — the one item in this group that is a
     stability bug rather than a polish gap, and the reason it's sequenced
     first. Replicate `BoxEditModal`'s pattern in the other three. Watch
     for handlers that close optimistically or delegate the request to the
     parent tab — those need the in-flight state lifted, not just a
     disabled attribute.
     _Value: Medium · Importance: Medium · Type: Bug / Reliability_

149. **`MotionCard` is defined twice, identically.** `const MotionCard =
     motion(Card)` appears in both `ItemCard.jsx:12` and `MealsTab.jsx:23`,
     each followed by the same `shouldAnimate ? MotionCard : Card`
     selection. #147 would make it three copies. Hoist one `MotionCard`
     (and ideally the selection helper) into the design system next to
     `Card`, so the "animate a card, unless the user turned motion off"
     decision has one home. Small, but it's the precondition that keeps
     #147 from being a copy-paste.
     _Value: Low · Importance: Medium · Type: Refactor / Design system_

150. **`ItemCard`'s swipe gesture is never disabled on desktop.**
     `ItemCard.jsx` doesn't import `useIsDesktop` at all, so its horizontal
     drag-to-mark-important stays mouse-draggable at desktop widths — even
     though the always-present star badge is the non-gesture route there,
     and even though `MealsTab.jsx:699` explicitly does the opposite for
     its week-pager (`drag={isDesktop ? false : "x"}`, with a comment
     saying swipe-paging is a touch affordance). This is the one place the
     otherwise-clean `useIsDesktop()` discipline has a hole; CLAUDE.md's
     "4 of 7 structural switches" inventory never counted this fifth
     touch-only gesture. Gate it the way MealsTab does.
     _Value: Low · Importance: Low · Type: UI consistency / Desktop_

151. **The tap-semantics divergence is undocumented.** Tapping a row means
     "toggle bought" in Shopping but "open the editor" in Meals and
     Storage. Per the decision above this stays as-is — but nothing in
     `CLAUDE.md` says so, so the next pass over this code has to
     re-derive whether it's intentional (it is) or drift (it isn't).
     Write it down alongside the long-press rule from #145, in the same
     place the four `useIsDesktop()` structural switches are already
     inventoried. Documentation only; no code change.
     _Value: Low · Importance: Medium · Type: Documentation_

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

## Done

See `Todo_done.md`.
