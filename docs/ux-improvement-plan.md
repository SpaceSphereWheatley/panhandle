# Panhandle UX improvement plan

A backlog of UX/reliability fixes from a critical end-to-end walkthrough of the
app (landing page, login, shopping list, meal planner, profile). Organized so it
can be picked up across separate sessions: each item has a stable ID (`T#`), a
priority, and the phase it belongs to. Check items off as they ship.

Working constraints (see `CLAUDE.md`): no build step, no test suite. Frontend
changes live in `public/app.html` / `public/index.html`; backend in
`worker/index.js`; schema changes need a new numbered file in `migrations/`
plus a manual `npx wrangler d1 migrations apply panhandle --remote`. Validation
is manual (deploy / open in a browser). Keep `VERSION` (worker) and
`APP_VERSION` (app.html) in sync on release and add a `CHANGELOG.md` entry.

## Decisions already made

- **T1 (meal → list)** is **deliberate, not automatic.** A planned meal gets an
  explicit "add ingredients to list" action that opens a picker so the user
  chooses which ingredients to add — they may already have some on hand or on
  the list. Do **not** auto-push all ingredients on save.
- **"Registrer deg" CTA** on the landing page is left as-is. The app stays
  invite-only, so the closed-beta modal is correct behavior. (Dropped from the
  backlog.)
- **"Nylig kjøpt" (recent items)** is *not* a bug to clear. It's already
  collapsible and tapping a bought item re-adds it, so it's a useful re-add
  palette. The only fixes are cosmetic: default it collapsed and auto-trim it
  (see T13).

---

## Backlog (grouped & sorted by priority)

### P0 — Core promise
- [x] **T1** — Deliberate "add ingredients to list" action on a planned meal:
  a picker listing the meal's stored ingredients with checkboxes (pre-filtered
  to exclude ones already on the active list), adding only the selected ones.
  *Ingredients are already stored on `meal_catalogue`; nothing surfaces them today.*

### P1 — Reliability & data safety (every-session friction)
- [x] **T2** — Optimistic UI for toggle / add / delete: update the DOM
  immediately, reconcile with the server in the background.
- [x] **T3** — Surface offline / failed actions instead of clearing the input as
  if the action succeeded (`addItem`/`toggleItem`/`delItem` currently swallow
  errors).
- [x] **T4** — Undo (or at minimum a confirm) on item delete; de-crowd the
  trash / more / check cluster on the card.
- [x] **T5** — Feedback when an add merges into an existing line (the API already
  returns `duplicate: true` + new `qty`; the UI ignores it).
- [x] **T6** — Graceful session-expiry: explain the logout instead of silently
  dumping to the login screen on a 401 (handle in the `api()` wrapper).

### P2 — Cheap, high-impact wins
- [x] **T7** — Enter-to-submit on login (wrap fields in a `<form>` or add a
  keydown handler).
- [x] **T8** — Loading / disabled state on the login button to prevent
  double-submit and the "frozen" feel.
- [x] **T9** — Show-password toggle (login + change-password fields).
- [x] **T11** — Make the destructive "Slett vare fra katalog" clearly
  global/cross-list in both wording and styling (it removes the catalogue entry
  from every list, past and future).
- [x] **T12** — Re-enable pinch-zoom: drop `maximum-scale=1.0, user-scalable=no`
  from the viewport meta in `app.html`.
- [ ] **T13** — Default-collapse "Nylig kjøpt" and auto-trim it (recent N or
  last 14 days, mirroring the `meal_plan` cleanup).

### P3 — Enhancements
- [ ] **T14** — Extend the meal-planning horizon beyond last/this/next week
  (the `weekOffset` clamp `[-1, 1]` and `/plan` 14-day delete).
- [ ] **T15** — Support multiple meals per day (e.g. lunch/dinner slots).
  *Needs schema: `meal_plan` is one-row-per-date today (`UNIQUE(list_id, plan_date)`).*
- [x] **T16** — Warn that editing a meal's ingredients rewrites them for every
  date that meal appears on (they're keyed to the meal name, shared).
- [ ] **T17** — "X varer igjen" summary on the shopping list.
- [ ] **T18** — Make the "2 melk" leading-quantity shorthand discoverable.
- [ ] **T19** — Contrast pass on muted (`#8B7D6E`) and struck-through "bought"
  text.
- [x] **T20** — `aria-label`s on icon-only buttons (list/grid view toggle, card
  actions).
- [ ] **T21** — Dark mode.
- [ ] **T22** — Move version / api-mismatch plumbing out of the user-facing
  Profile into the admin subpage (or a debug-only view).

### Decided against
- ~~**T10** — Rework the "Registrer deg" CTA.~~ App stays invite-only; the
  closed-beta modal is correct.

---

## Phased execution plan

Phases are ordered so dependencies fall out naturally and visible value ships
early. Each phase is a reasonable unit for a single session.

### Phase 0 — Quick frontend wins (no backend, no schema)
**T7, T8, T9, T11, T12, T20.** Isolated edits to `app.html`/`index.html`,
instantly verifiable in a browser, lowest risk. Good warm-up that ships visible
improvement before the harder work.

### Phase 1 — List reliability
**T2 → T3 → T5 → T4, plus T6.** Do optimistic UI (T2) first because T3/T4/T5
all build on the same render/reconcile path. T6 (better 401 handling) rides
along in the `api()` wrapper. No schema changes; the duplicate signal already
exists in the API.

### Phase 2 — The core feature
**T1, with T16.** The headline. Depends on the list-write path being solid
(Phase 1). Deliberate picker per the decision above. T16 (shared-ingredient
warning) belongs in the same meal-modal work. Touches `worker/index.js`
(serve ingredients for a planned meal) and the meal modal; no schema change
expected (ingredients already stored).

### Phase 3 — Recent-list & meal-planner polish
**T13, T14, T15, T17, T18.** Mostly independent and small. T13/T17/T18 are
frontend-only. T14 touches the week clamp + `/plan` cleanup window. **T15 needs
a schema migration** (a meal-slot column + revised uniqueness), so batch its
backend/migration work deliberately.

### Phase 4 — Look & feel
**T19, T21, T22.** Pure styling / cleanup, safe to do last.

---

## Per-session checklist

1. Pick a phase (or a few items from it).
2. Branch work stays on `claude/epic-planck-54w758`.
3. For backend/schema items, add the migration file and run the `wrangler`
   apply step manually — it is not wired into CI.
4. Bump `VERSION` + `APP_VERSION` together and add a `CHANGELOG.md` entry when
   shipping a release.
5. Check the item(s) off in this file.
