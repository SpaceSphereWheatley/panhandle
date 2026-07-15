# Panhandle UI review & implementation plan

A second-pass, UI-focused review of the app (landing page, login, shopping list,
meal planner, settings/admin) plus a dedicated audit of every button/interactive
element. This is distinct from `docs/ux-improvement-plan.md` (the `T#` series,
now essentially shipped) — it picks up the visual/interaction/accessibility
rough edges that remain. Each item has a stable ID (`U#`), a priority, and a
phase, so it can be picked up across sessions. Check items off as they ship.

> **Note:** the working constraints below predate the Vite + React rewrite — the frontend now has a build step and a Vitest test suite; see `CLAUDE.md` for current architecture. Left as originally written since most `U#` items themselves are still accurate/open.

Working constraints (as of writing, see `CLAUDE.md`): **no build step, no framework, no test
suite.** Frontend lives in `public/app.html` (single file, inline `<style>` +
`<script>`) and `public/index.html` (landing). Validation is manual
(deploy / open in a browser). Keep `VERSION` (worker) and `APP_VERSION`
(`app.html`) in sync on release and add a `CHANGELOG.md` entry (+ copy it into
`public/CHANGELOG.md`).

## Already covered (don't redo)

- **aria-labels** on icon-only buttons — done (`T20`).
- **Muted-text contrast** pass on `--muted` / struck-through "bought" text —
  done (`T19`). *This is separate from `U1` below, which is about the
  white-on-`--tile` card background, not muted text.*
- **Escape-to-close** on modals — a `keydown` handler already calls
  `closeModal()` (supersedes `TODO.md #2`).
- **Service worker / offline** is already logged as `TODO.md #1`; `U15` here is
  the same work, expanded — keep them in sync and strike both together.

---

## Backlog (grouped & sorted by priority)

### P0 — Correctness & accessibility (cheap, high-trust)
- [ ] **U1** — **Contrast on item cards/tiles.** White text on `--tile`
  (`#9CAF88`) is ~2.3:1, well under WCAG AA 4.5:1 — and item names are the one
  thing you must read at a glance in a store. Darken the card background (toward
  `--accent` `#556B2F`, which carries white text fine) or switch card text to a
  dark ink, then re-check every fg/bg pair. Touches `.card`, `.grid-card`, and
  their `.bought` variants.
- [ ] **U2** — **Error text rendered in brand green.** `#loginErr` uses
  `--accent-text` (olive), and `memberMsg`/`ownerMsg` use `--accent`, so failed
  logins and validation errors read as success. Route all error text through
  `--danger`.
- [ ] **U3** — **No focus-visible states anywhere.** `-webkit-tap-highlight-color`
  is disabled globally and no `:focus-visible` outline is defined, so keyboard /
  switch users get no focus indication. Add a shared `:focus-visible` ring to
  all interactive elements (buttons, inputs, clickable rows).
- [ ] **U4** — **`prefers-reduced-motion` ignored.** The modal `slideup` and the
  toggle shrink/fade (`.resolving`) always animate. Gate the non-essential
  animations behind `@media (prefers-reduced-motion: no-preference)`.

### P1 — Button system & danger semantics
*Root cause across these: "the green" currently means brand, primary action, AND
destructive action, and several controls have no button chrome or press state.*
- [ ] **U5** — **Add a real `.btn-danger`; stop skinning deletes as `.cancel`.**
  "Slett vare fra katalog", "Slett måltid fra katalog", and the meal modal's
  per-day "Slett" all reuse the grey `.cancel` class with only a red *text*
  override — so in the meal modal two identical grey buttons sit side by side,
  one of which deletes. Give destructive actions a dedicated danger style.
- [ ] **U6** — **Give bare icon buttons real button chrome + ≥44px hit area.**
  `.card .more` / `.card .del`, `.meal-name-arrow`, and the install-banner
  `.dismiss` are `background:none;border:none` floating icons (`padding:4px 8px`)
  that don't read as tappable and are under the touch-target minimum. Add a
  subtle surface/border and enlarge the target — or move edit/delete entirely
  into the swipe + modal so the card isn't carrying bare icons.
- [ ] **U7** — **`:active` press feedback on all buttons.** With tap-highlight
  disabled and `:hover` only present on the landing page, most in-app buttons
  acknowledge a tap with nothing. Add a shared pressed state.
- [ ] **U8** — **Promote weak text-link primary actions.** The meal planner's
  per-day **"Endre" / "Legg til"** — the primary action on that screen — is
  small green text floated into the card corner (`.day .edit`,
  `background:none`). Make it a proper button, or make the whole day card the
  tap target.
- [ ] **U9** — **Real semantics for clickable `<div>`s.** The shopping item
  `.card` and the `.suggestions` autocomplete rows are `div`s with `onclick` —
  not keyboard-focusable, no role. Convert to `<button>` (as the settings
  nav-rows and `.meal-browse-row` already correctly are) or add
  `role="button"` + `tabindex` + key handlers.
- [ ] **U10** — **Normalize button radii/padding.** Radii drift across
  8/10/12/14px with assorted paddings. Factor a shared button base so variants
  differ only by color/size.

### P2 — Replace native dialogs
- [ ] **U11** — **Replace the 7 `confirm()` / `alert()` calls** (remove member,
  delete catalogue item, delete meal, reset password, and error paths) with the
  app's own `.modal` + `showToast` components. Native OS dialogs are unstyled,
  unthemed (jarring in dark mode), and out of place in an installed PWA.

### P3 — Reliability / PWA (bigger, test carefully)
- [x] **U12** — **App-shell service worker.** Shipped (1.15.0, per `CHANGELOG.md`):
  `public/sw.js` does stale-while-revalidate app-shell caching (everything except
  `/api/*` and `/seed`), registered from `src/main.jsx`. The `TODO.md #1` this
  once matched has since been renumbered to a different (still-open) item —
  see `TODO.md`'s own numbering note.
- [ ] **U13** — **Offline write queue.** Let add/toggle/delete happen offline and
  reconcile on reconnect, instead of hard-failing with a toast. Depends on U12.
- [ ] **U14** — **Self-host / bundle Roboto.** The app render-blocks on
  `fonts.googleapis.com`; self-hosting removes a third-party dependency, speeds
  first paint, and helps the offline story (U12). Fallback stack already exists.

### P4 — Interaction clarity
- [ ] **U15** — **First-run coach-mark for gestures.** Swipe-to-complete,
  long-press-to-edit, and the tap-to-re-add "Nylig kjøpt" palette are all
  invisible today. Show a one-time hint. *(Also addresses the overlapping/
  undiscoverable gesture model: tap and swipe both mark bought.)*
- [ ] **U16** — **Loading skeletons on first fetch.** On boot with a saved token
  the app reveals empty containers before data arrives. Add skeletons/spinners
  for `listContainer` / `planContainer`.
- [ ] **U17** — **Make sync status legible.** "Oppdatert HH:MM" is 11px muted in
  the header; for two people editing live, currency matters. Give it more weight
  and an explicit "Synkroniserer…" state.
- [ ] **U18** — **Strengthen the recurring hint + add save confirmation.** The
  "Fast ansvarlig" line is 50% opacity italic (easy to miss); recurring-day
  changes save silently (toast only on error). Firm up the hint and confirm
  saves.

### P5 — Forms & small UX
- [ ] **U19** — **Confirm-password field on change-password.** Only a 6-char
  minimum today; a single typo locks a user out until an admin reset. Add a
  confirm field (and optionally a strength hint).
- [ ] **U20** — **Per-category counts + collapse/expand-all.** Category headers
  are collapsible but show no item count and there's no bulk toggle.
- [ ] **U21** — **Chip/token editor for meal ingredients & labels.** Both are
  comma-separated free-text inputs (fiddly on a phone keyboard, no dedupe
  feedback). Move to token editors with catalogue-backed autocomplete so
  ingredients map cleanly to catalogue names for the "add to list" flow.
- [ ] **U22** — **Human-readable admin list labels.** The admin "Alle brukere"
  panel groups by raw `Liste {id}`; show the owner's name (or a label) instead.
- [ ] **U23** — **Nudge seeded accounts to change their password.** The invite
  text mentions it; show a one-time in-app banner until it's changed.

### P6 — Larger net-new (each its own effort)
- [ ] **U24** — **Responsive desktop layout.** The app is hard-capped at
  `max-width:480px` and centered, so desktop is a narrow phone column in empty
  space with a bottom tab bar — despite the landing page's "mobil og desktop"
  claim. Add a real ≥768px layout (e.g. two-column list + meals, sidebar nav).
  *Note the current cap was a deliberate earlier decision (`TODO.md` Done) —
  this revisits it, so confirm before building.*
- [ ] **U25** — **"Shopping mode."** Hide bought items, large high-contrast
  text, keep-screen-awake — a mode tuned for actually walking the store.
- [ ] **U26** — **Cook-again / repeat a past meal** — one-tap re-plan of a
  previous meal; complements the labels filter.
- [ ] **U27** — **Multi-week / month meal overview** for planning past the
  current one-week strip (`weekOffset` is `[-1, 4]`).

---

## Recommended course of action

Ship in three arcs, cheapest-and-safest first:

1. **Release A — "UI consistency & accessibility" (P0 + P1 + P2).**
   All frontend-only, no schema, individually verifiable in a browser, and
   collectively the biggest trust/polish jump: fixes the contrast and
   error-color bugs, gives every button a coherent look + focus/press/danger
   states, and removes the native dialogs. Bump a **MINOR** version (new
   user-facing polish, completes the button/a11y pass).

2. **Release B — "Offline & reliability" (P3).**
   The service worker (U12, now shipped — see above) was the single
   highest-value reliability upgrade; U13/U14 remain open and can ride along
   in a future release now that U12's caching foundation is in place.

3. **Incremental — P4 → P5**, a couple of items per session, each shippable on
   its own. **P6** items are larger and partly product decisions (esp. U24,
   which reverses an earlier call) — scope and confirm each before building.

Rationale: P0/P1/P2 are almost entirely CSS + small DOM/handler edits with no
backend or schema risk, so they're the right warm-up and deliver visible value
immediately; P3 is where the real engineering (and risk) lives, so it gets its
own release; everything else is additive.

---

## Per-session checklist

1. Pick a phase (or a few items from it); keep work on
   `claude/app-ui-review-yaqv3q`.
2. Frontend-only for P0–P2, P4–P5; P3 (service worker) needs a new
   `public/sw.js` + registration and careful cache-version handling.
3. Bump `VERSION` + `APP_VERSION` together and add a `CHANGELOG.md` entry
   (copy into `public/CHANGELOG.md`) when shipping a release.
4. Check the item(s) off here, and strike the matching `TODO.md #1` when U12
   ships.
