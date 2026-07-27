# TODO

Open items, numbered and grouped by theme; within each group, sorted by
importance (highest-importance first, ties broken by value). Numbers are stable IDs for reference in
commits/discussion — don't renumber when items are completed, just strike
them and move to `Todo_done.md`; re-pack (renumber) only when the open list
gets sparse. Full "fixed in" details live in `CHANGELOG.md`, not here.
Completed items live in `Todo_done.md`, not below.

**Group priority** (highest to lowest, reassessed 2026-07-21):
1. **Bugs** — 5 low-priority latent/edge issues remain from the two QA/audit
   passes (2026-07-18, 2026-07-20): #87, #88, #89, #92, #94. Everything else
   from both passes, plus #114, is fixed — see `Todo_done.md`.
2. **Small UI/polish items — low value, low risk, good filler:**
   - **#5** Poll-interval backoff when idle (explicitly: don't do
     speculatively, only if load actually grows)
3. **Multi-list data model (#1)** — high ceiling if this app ever needs
   more than one household/list, but nothing today needs it (still just
   2 users, 1 list) and it's a real schema/data-model change, not a small
   one. Correctly deferred; revisit only if a concrete second-list need
   shows up.

## Bugs

5 low-priority latent/edge bugs remain, found across two QA/audit passes
(2026-07-18 and 2026-07-20; file:line refs below are from those passes —
verify before fixing). Everything else from both passes, plus #114, is
fixed — see `Todo_done.md`.

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

94. Service-worker asset cache grows unbounded. `sw.js` (~L56) caches
    content-hashed JS/CSS cache-first and never prunes; `CACHE_NAME` is fixed
    at `panhandle-shell-v1`, so every deploy's old hashed assets accumulate
    forever. Not a correctness bug (the shell is correctly network-first), but
    unbounded storage over many deploys. Prune stale entries, or bump a
    versioned cache name on release.
    _Value: Low · Importance: Low · Type: Bug / Offline / Caching_

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

## Ideas (unvetted)

Raw suggestions from the 2026-07-20 app-audit — **not** accepted work like the
items above, and not yet weighed against effort/appetite. Promote an idea into
a real section (Feature / Data model / …) once it's actually decided on; delete
the ones that don't earn their keep. Keep the same stable-ID discipline.

_High value, low effort:_

101. Quantity stepper on the item card (subtle +/- or long-press) so the common
     "need 2, not 1" adjustment doesn't require opening the edit modal.
     _Value: Medium · Importance: Low · Type: Idea / Shopping list_

102. Surface the purchase-history stats already tracked per catalogue item
     (`times_bought`/`first_bought`/`last_bought`) in the edit modal — e.g.
     "kjøpt 12×, ca. hver 9. dag" — making the data behind the smart
     suggestions visible, not just predictive.
     _Value: Medium · Importance: Low · Type: Idea / Shopping list_

_High value, medium effort:_

103. Recipe → meal ingredient import. Meals already carry a free-form
     `ingredients` JSON; let a meal pull a starter ingredient list (paste a
     recipe, or a small built-in library) to strengthen the "Fra
     middagsplanen" flow.
     _Value: Medium · Importance: Low · Type: Idea / Meals_

104. Assign/claim shopping-list items, mirroring meal `responsible` — "you grab
     the pharmacy stuff, I'll do groceries." Reuses the existing avatar/presence
     UI and the by-value username pattern.
     _Value: Medium · Importance: Low · Type: Idea / Shopping list_

_Exploratory / higher ceiling:_

106. Optional spending log — capture price-per-purchase on toggle-bought, turning
     the existing purchase-stats tables into a lightweight budget view. Adds a
     schema column + UI; genuinely differentiating for a grocery app.
     _Value: Medium · Importance: Low · Type: Idea / Meals + Shopping_

107. Pantry / "have at home" state to suppress suggestions for staples you keep
     stocked, complementing the current overdue-interval suggestions.
     _Value: Low · Importance: Low · Type: Idea / Shopping list_

108. Seed new lists from a shared `seed_catalogue` table (copy-on-create)
     instead of the 710-entry `COMMON_ITEMS` array duplicated between
     `worker/index.js` and migrations 0002/0003 — kills a documented drift
     hazard. Refactor, not a user-facing feature.
     _Value: Low · Importance: Low · Type: Idea / Refactor_

## Done

See `Todo_done.md`.
