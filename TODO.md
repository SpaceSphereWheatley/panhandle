# TODO

Open items, numbered and grouped by theme; within each group, sorted by
value (highest-value first). Numbers are stable IDs for reference in
commits/discussion — don't renumber when items are completed, just strike
them and move to `Todo_done.md`; re-pack (renumber) only when the open list
gets sparse. Full "fixed in" details live in `CHANGELOG.md`, not here.
Completed items live in `Todo_done.md`, not below.

**Group priority** (highest to lowest, reassessed 2026-07-18):
0. **Bugs (#81–#89)** — found in a full QA/QC pass 2026-07-18. The two P0s
   (#79, #80) are fixed (see `Todo_done.md`). #81–#83 are P1; #84–#89 are
   low-priority latent/edge issues.
1. **Small UI/polish items — low value, low risk, good filler:**
   - **#6** Proper desktop layout (not just raising the width cap)
   - **#5** Poll-interval backoff when idle (explicitly: don't do
     speculatively, only if load actually grows)
2. **Multi-list data model (#1)** — high ceiling if this app ever needs
   more than one household/list, but nothing today needs it (still just
   2 users, 1 list) and it's a real schema/data-model change, not a small
   one. Correctly deferred; revisit only if a concrete second-list need
   shows up.
3. **i18n (#15)** — largest effort of anything open (touches nearly every
   component) with no expressed need (household is Norwegian-only);
   lowest priority despite medium value.

Notifications (#7) shipped in full (phases 1–2) and is closed — see
`Todo_done.md`. Batched item-added notifications, the one theoretical
remaining phase, were considered and explicitly declined: not worth it
for a 2-person household that already has the on-demand "Varsle
husstanden" ping.

## Bugs

Found in a full QA/QC review pass (2026-07-18). Prioritized: P0 first, then
P1, then low-priority latent/edge issues. File:line refs are from that pass —
verify before fixing.

P0 items #79 and #80 are fixed — see `Todo_done.md`.

### P1 — High / Medium

81. Meal & weekly reminders silently never fire for users who never opened
    the reminder settings. `GET /notification-settings` and the UI both
    default the two reminder toggles to **true** with no row present
    (`worker/index.js` ~L2518–2521, `VarslerSubpage.jsx` ~L33–36), but the
    cron only sends to lists that have an actual row
    (`checkMealReminders`/`checkWeeklyReminders`, `WHERE …_enabled = 1`,
    ~L1230/L1271). No row is created until a reminder control is changed;
    enabling push (`/push/subscribe`) doesn't create one. So a user enables
    notifications, sees both toggles ON, and never gets a reminder.
    _Value: Medium · Importance: Medium · Type: Bug / Notifications_

82. Cross-user shopping-list leak on shared devices. `ITEMS_CACHE_KEY`
    (`ph_cache_items_v1`) is global, not namespaced per user/list, and hydrated
    on mount (`ShoppingListTab.jsx` ~L67); `logout()` only clears the
    `ph_token/ph_user/…` keys (`AuthContext.jsx` ~L17–33). On a shared
    household device (an explicitly supported case), the next user briefly
    sees the previous user's items from a different list until the first
    refresh. Fix: clear `ph_cache_*` on logout, or key the cache by `list_id`.
    _Value: Medium · Importance: Medium · Type: Bug / Privacy_

83. Password-length floor is weaker for change-password than for signup.
    `/register` and `/reset-password` require ≥ 8 chars (`worker/index.js`
    ~L1387, ~L1524) but `/change-password` requires only ≥ 6 (~L1581; UI text
    also says "min. 6 tegn"). A user can lower their password strength below
    the signup minimum after registering. Standardize on 8.
    _Value: Medium · Importance: Low · Type: Bug / Auth_

### P2 — Low (latent / edge)

84. Stale-item marker likely never shows on iOS Safari (primary platform).
    `ItemCard.jsx` (~L33) does `new Date(item.added_at)` where `added_at` is
    SQLite `datetime('now')` → `"YYYY-MM-DD HH:MM:SS"` (UTC, space-separated,
    no `Z`). That's parsed as local time (harmless offset for a day
    threshold) and isn't reliably parseable in Safari, where it can yield
    `Invalid Date` → `NaN` compare → marker never appears. Normalize to ISO
    (`T…Z`) before parsing.
    _Value: Low · Importance: Low · Type: Bug / Date handling_

85. "Legg til nøyaktig som skrevet" isn't actually exact. The exact-add path
    (`ShoppingListTab.jsx` ~L179) still POSTs `/list`, which runs
    `extractGlutenFree` server-side (`worker/index.js` ~L2110), so an item
    literally containing "gf"/"glutenfri" gets stripped and a "Glutenfri"
    note appended — not verbatim.
    _Value: Low · Importance: Low · Type: Bug / Shopping list_

86. `/plan` POST wipes `responsible` when it's omitted: `responsible || ""`
    (`worker/index.js` ~L2423) overwrites via
    `ON CONFLICT … SET responsible = excluded.responsible`. Not triggered by
    the current UI (always sends both fields), but a latent data-loss footgun
    for any partial save.
    _Value: Low · Importance: Low · Type: Bug / Meals_

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

## Done

See `Todo_done.md`.
