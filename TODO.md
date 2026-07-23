# TODO

Open items, numbered and grouped by theme; within each group, sorted by
importance (highest-importance first, ties broken by value). Numbers are stable IDs for reference in
commits/discussion — don't renumber when items are completed, just strike
them and move to `Todo_done.md`; re-pack (renumber) only when the open list
gets sparse. Full "fixed in" details live in `CHANGELOG.md`, not here.
Completed items live in `Todo_done.md`, not below.

**Group priority** (highest to lowest, reassessed 2026-07-21):
0. **Reliability — offline write durability (#113)** — DONE (1.39.0, see
   `Todo_done.md`). A persisted outbound queue now keeps an add/toggle made
   with no signal and replays it on reconnect.
1. **Bugs (#87–#99)** — #87–#89 from the 2026-07-18 QA/QC pass; #91–#99 from
   a second full app-audit pass 2026-07-20. All low-priority latent/edge
   issues. The two P0s (#79, #80), all three P1s (#81–#83) plus the
   2026-07-20-audit P1 (#90), P2 #84–#86, and the 1.39.1 batch (#91, #93,
   #95, #96, #97, #99) are fixed (see `Todo_done.md`); #87, #88, #89, #92,
   #94, #98 remain open.
2. **Small UI/polish items — low value, low risk, good filler:**
   - ~~**#100** "Tøm handlede" bulk-clear (end-of-trip sweep)~~ — DONE (1.40.0,
     see `Todo_done.md`).
   - **#6** Proper desktop layout (not just raising the width cap)
   - **#5** Poll-interval backoff when idle (explicitly: don't do
     speculatively, only if load actually grows)
   - **#98** catalogue-delete blast-radius wording (from the 2026-07-20 audit)
3. **Custom aisle/store ordering (#105)** — DONE (1.40.0, see `Todo_done.md`).
   A per-list `category_order` store now lets a household reorder aisles to
   match their store's layout.
4. **Multi-list data model (#1)** — high ceiling if this app ever needs
   more than one household/list, but nothing today needs it (still just
   2 users, 1 list) and it's a real schema/data-model change, not a small
   one. Correctly deferred; revisit only if a concrete second-list need
   shows up.
5. **i18n (#15)** — largest effort of anything open (touches nearly every
   component) with no expressed need (household is Norwegian-only);
   lowest priority despite medium value.

Notifications (#7) shipped in full (phases 1–2) and is closed — see
`Todo_done.md`. Batched item-added notifications, the one theoretical
remaining phase, were considered and explicitly declined: not worth it
for a 2-person household that already has the on-demand "Varsle
husstanden" ping.

## Bugs

Found in a full QA/QC review pass (2026-07-18). File:line refs are from that
pass — verify before fixing.

P0 items #79 and #80, P1 items #81–#83 and #90, and P2 items #84–#86 are
fixed — see `Todo_done.md`. Items #91–#99 were found in a second full
app-audit pass (2026-07-20); file:line refs are from that pass — verify
before fixing. Of those, #91, #93, #95 (and UI-section #96, #97, #99) are
now fixed too (1.39.1, see `Todo_done.md`); #87, #88, #89, #92, #94 remain.

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

## Feature

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

## UI / Polish

6. Create a proper viewing window for desktop. Today the layout is
   deliberately mobile-first with a fixed `max-width: 480px` centered
   column at any viewport size (`src/index.css:34`) — a past decision
   documented in `Todo_done.md` chose this over a separate desktop layout.
   Revisiting it means an actual desktop design (wider content, maybe a
   two-pane or sidebar layout), not just raising the cap; low priority
   since this is a 2-person app used mostly on phones.
   _Value: Low · Importance: Low · Type: UI / Layout_

98. Catalogue delete from the shopping list is more destructive than it looks.
    `DELETE /list/:id/catalogue` removes the catalogue row and cascades to
    every `list_items` line referencing it (history included), not just the one
    occurrence. Confirm `ItemEditModal`'s wording makes that blast radius
    clear, or add a distinct confirmation.
    _Value: Low · Importance: Low · Type: UI / Shopping list_

114. Butikkoppsett's category-reorder row layout: reported (2026-07-23) that
     the drag handle sits to the right of the up/down arrow buttons — worth a
     look at whether that's the most intuitive grab-target placement. Note:
     the row's JSX (`src/components/settings/subpages/ButikkSubpage.jsx`
     `CategoryRow`, ~L136-171) currently orders it dot → name → drag handle →
     ↑ → ↓ in a plain (non-reversed) flex row, i.e. drag handle *left* of the
     arrows in source — re-check against the actual rendered UI before
     changing anything, since that doesn't match the reported order.
     _Value: Low · Importance: Low · Type: UI / Settings_

## Dev process / policy

Process/documentation improvements from the 2026-07-20 dev-policy review (see
that pass for the reasoning). All internal housekeeping — CLAUDE.md/docs only,
no `VERSION` bump. #1–#3 from the same review are larger and have their own
implementation plans (not listed here).

~~#109 (clarify "wait for checks/review"), #110 (never merge on red CI), #111
(rollback runbook), #112 (`d1_migrations` drift reconcile)~~ — all DONE, see
`Todo_done.md` and CLAUDE.md's Workflow conventions / Deployment sections.

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

(Batched "item added" push was already considered and declined — see the
Notifications note at the top — noted here only so it isn't re-proposed.)

## Done

See `Todo_done.md`.
