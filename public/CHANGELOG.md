# Changelog

## [1.20.2] — 2026-07-14

### Fixed
- **iOS "Add to Home Screen" used a screenshot thumbnail instead of the app
  icon.** iOS Safari ignores `manifest.json`'s icons for home-screen
  installs entirely — added an `apple-touch-icon` link to `app.html` and
  `public/index.html`.
- **Auth screens (login/signup/forgot/reset password) could clip or show a
  phantom scrollbar on iOS Safari** as the address-bar/toolbar chrome
  showed/hid, since `100vh` includes that chrome in its calculation. Swapped
  to `100dvh` (dynamic viewport height) on all four screens.

## [1.20.1] — 2026-07-14

### Fixed
- **Landing page's "Registrer deg" button.** It still opened a static "we're
  in closed beta, contact Mohibb" modal, a leftover from before self-service
  signup existed — now links straight to the real signup screen
  (`/app.html?signup=1`). The dead modal markup/CSS/JS was removed.

## [1.20.0] — 2026-07-14

### Added
- **Self-service signup, "Sign in with Google", and email-based password
  recovery.** Anyone can now create their own household directly from the
  login screen ("Opprett ny husstand") — no more asking the developer to
  create an owner account by hand. New public `POST /register`,
  `POST /auth/google`, `POST /forgot-password`, and `POST /reset-password`
  endpoints on the Worker; signup is protected by Cloudflare Turnstile plus
  an IP rate limit (mirroring the existing `login_attempts` pattern), and a
  Google sign-in with a matching email links onto an existing password
  account instead of creating a duplicate. Email delivery uses Resend.
- **Add/change your email from Settings → Profile.** Existing accounts
  (created via `/seed`, `/admin/owners`, or `/list-users`) have no email on
  file, so without this there was no way for them to link a Google sign-in
  or use `/forgot-password` short of a manual DB edit. New authenticated
  `GET /account` and `POST /change-email` endpoints (the latter requires
  the current password, same as `/change-password`, since email is what
  password recovery trusts).

## [1.19.3] — 2026-07-14

### Changed
- `HomeIsland` now determines its own owner-only rendering via `useAuth()`
  directly instead of taking `isOwner` as a prop, matching how
  `AdminIsland` already self-checks its own permission — one consistent
  pattern for privileged-section gating across Settings.
- Every modal now passes its heading through `Modal`'s `title` prop
  (forwarded to the shared `Sheet`) instead of hand-rolling its own
  `<h3>`.

### Removed
- The orphaned `.theme-toggle` CSS rule and the now-dead `.modal h3` rule.
- 8 inert `eslint-disable-next-line` comments (ESLint isn't installed or
  configured in this project).

## [1.19.2] — 2026-07-14

### Changed
- Grew the suggest-item add button and the meal-name dropdown arrow from
  32px to 48px/40px, closer to a ~44–48px touch-target minimum.
- `AdminIsland`/`MembersIsland` user rows now animate in/out with the same
  Framer Motion treatment used elsewhere in the app (respecting reduced-
  motion/design-intensity settings).

### Investigated
- Confirmed the shopping list's grid view no longer has the single-item
  category row artifact described in the backlog — it already renders one
  continuous aisle-sorted grid instead of a grid per category. Also
  re-measured the bottom-nav tab buttons and ingredient-row tap targets;
  both already meet the ~44–48px guideline once padding is accounted for.
  No code change needed for either.

## [1.19.1] — 2026-07-14

### Fixed
- `SettingsTab` now stays mounted (hidden) after the first visit like the
  other two tabs, instead of remounting on every switch — it no longer
  redoes its admin counts, user list, and recurring-meal fetches every
  time you open Innstillinger.

## [1.19.0] — 2026-07-14

### Added
- A custom, app-styled confirmation dialog (`useConfirm`) replaces native
  `confirm()` everywhere, and now consistently gates every
  destructive/sensitive action — including two that previously had no
  confirmation at all: deleting a planned meal day, and changing a user's
  admin/owner access.
- Shared loading and empty-state components. The shopping list and meal
  planner now show a loading indicator on their initial fetch instead of
  looking indistinguishable from a genuinely empty list/week, and several
  modals (`MealPlanModal`, `MealCatalogueBrowseModal`,
  `WeekIngredientsModal`, `IngredientPickerModal`) that used to render
  blank while loading now show the same indicator.

### Changed
- Meal-plan save/delete are now optimistic (instant local update,
  roll back with a toast on failure) instead of blocking the modal open on
  a full network round trip, matching the shopping list's item-toggle
  behavior.
- Error and confirmation feedback across Settings (`AdminIsland`,
  `MembersIsland`, `ProfileIsland`) and the item/meal edit modals is now
  consistently a toast, replacing a mix of inline colored text (with two
  different, inconsistent colors), native `alert()`, and silently dropped
  failures.

## [1.18.4] — 2026-07-14

### Changed
- Consolidated modal Cancel/Save button pairs, hand-copied text inputs,
  icon-only buttons, and the "Eier"/"Admin" member pills onto the shared
  design-system `Button`, `Input`, `IconButton`, and `Badge` components
  instead of ad hoc `className`/inline-style copies.
- Routed the app's duplicated semantic icons (the expand/collapse chevron,
  the shopping-list view toggle) through the existing `UiIcon` wrapper
  instead of raw hand-sized icon tags, so the same icon renders at one
  consistent size everywhere it's used as a plain indicator.

## [1.18.3] — 2026-07-14

### Fixed
- Recurring-meal responsibility save failures (`RecurringIsland`) are now
  surfaced via toast instead of failing silently.
- `CredentialsModal`'s invite-copy button now shows success/failure via
  toast and only closes the modal after a successful copy.

## [1.18.2] — 2026-07-14

### Accessibility
- Shopping-list item cards (`ItemCard`/`ItemGridCard`) are now reachable and
  operable by keyboard/screen reader — `role="button"`, `tabIndex`, and an
  Enter/Space handler for toggling bought, matching the pattern already used
  by the PWA install CTA.
- Modals (`Sheet.jsx`, shared by every modal) now move focus in on open,
  trap `Tab` inside the sheet, restore focus to the trigger on close, and
  expose `role="dialog"`/`aria-modal`.
- Every form `<label>` in `ItemEditModal`, `MealEditModal`, `MealPlanModal`,
  and the admin/member/recurring settings forms is now programmatically
  associated with its input (`htmlFor`/`id`, or `aria-label`/
  `aria-labelledby` where a visible label didn't fit); `ProfileIsland`'s
  password fields gained visible labels instead of relying on placeholder
  text alone.
- Fixed `--text-tertiary`'s light-mode contrast (was ~3.9–4.1:1 against
  card/page surfaces) to meet the 4.5:1 WCAG AA threshold for normal text.
- `Header`'s back button now has an `aria-label`.
- The toast container now announces itself to screen readers via
  `role="status"`/`aria-live="polite"`.

## [1.18.1] — 2026-07-14

### Fixed
- **Switching tabs still visibly "flew in" cards from the top-left corner**,
  even after the fix that kept Handleliste/Måltider mounted across tab
  switches (1.17.4-era). That fix stopped the data from resetting, but the
  item/day cards use Framer Motion's `layout` animation, which measures
  position via `getBoundingClientRect()` — and a `display: none` pane (how
  inactive tabs are hidden) measures as a zero-size box pinned at `(0,0)`.
  Reactivating the tab made Framer see a jump from that stale `(0,0)` rect to
  the real position and animate it, i.e. every card flying in from the
  top-left for one frame. `layout` is now only enabled while the tab is
  actually active, so its first measurement on reactivation is the real
  position with nothing to interpolate from.

## [1.18.0] — 2026-07-13

### Added
- **Site-wide admin metrics dashboard.** A new "Statistikk (alle lister)"
  section under Innstillinger → Administrasjon (superadmin-only) shows usage
  across every list: user/list counts, signups and new lists per week,
  shopping activity (items added per week, bought vs. total, most-bought
  items), meal-plan fill rate and most-planned meals, and a per-list
  breakdown table. Gated beyond ordinary `is_admin` by a new
  `SUPERADMIN_USERNAMES` Worker variable (`GET /admin/metrics`), since
  `is_admin` is normally scoped to a single list.

## [1.17.2] — 2026-07-13

### Fixed
- **Deleting a meal from Måltider could silently wipe who's responsible for
  that day.** The day's plan row was tied to its meal with a cascading
  delete, so removing a meal from the catalogue deleted the whole day's
  entry — including the responsible person — instead of just unassigning
  the meal. Deleting a meal now correctly reverts the day to unplanned
  while keeping who's responsible.
- **Handleliste's delete button forgot the whole item, not just the line.**
  Deleting an item from the shopping list cleared its saved category and
  purchase history and removed every matching line on the list, even ones
  you didn't mean to touch. Delete now just removes the tapped line; a
  separate, clearly-labeled "forget this item entirely" option is still
  available if you actually want to reset its history.
- **A mistyped date sent from a broken client could get stuck in the meal
  plan.** `POST /plan` now rejects a malformed date instead of silently
  accepting it.

### Security
- Hardened the one-time account-setup endpoint's secret check against
  timing attacks (it now uses the same constant-time comparison as login).
- Changing your password is now rate-limited the same way login attempts
  are, so a stolen device token can't be used to endlessly guess your
  current password.

## [1.17.1] — 2026-07-13

### Fixed
- **Handleliste's grid view could settle on 2 columns instead of 3.** The
  grid-view item tiles sized their minimum track width at a fixed 140px,
  which didn't leave room for a 3rd column on narrower phone widths. The
  minimum now scales down to fit the row (capped at 140px), so it reliably
  lays out up to 3 columns.
- **The Android/browser back button no longer closed open modals.** The
  rewrite to Vite + React dropped the modal/history integration entirely —
  pressing back while any modal was open just stepped through (or exited)
  the tab-switch history underneath it, leaving the modal stuck open.
  Modals now push a history entry while open again, so back closes the
  modal first and returns to the tab/screen underneath, matching the
  original 1.4.1 behavior.

## [1.17.0] — 2026-07-13

### Added
- **Material 3 Expressive redesign, with a new Designintensitet setting.**
  A new "Designintensitet" segmented control (Innstillinger → Meg & min
  app) lets you dial the app's visual language between **Ekspressiv**
  (default — asymmetric "blob" card shapes, heavier display type, full
  spring physics), **Dempet** (symmetric shapes, shorter linear motion),
  and **Klassisk** (flat corners, no spring animation, forced list layout
  — a calmer, more accessible option).
  - **Handleliste** now groups items into colored "aisle" clusters per
    category (dairy, produce, bakery, …), with an adaptive grid that
    reflows with spring physics as you check items off.
  - **Måltider**'s "I dag" card is now visually prioritized — an inverted,
    elevated surface with its own shape and larger type — instead of a
    thin accent border, and responsible-person avatars are bigger and
    more distinct.
  - **Innstillinger** is now 4 grouped island containers instead of a
    drill-down menu, with a big install-app call-to-action and a 2×2
    admin stats dashboard.
  - Note: the Settings screen no longer has its own back-button history
    step, since it's a single screen now rather than a subpage stack —
    this is intentional, not a regression.

## [1.16.1] — 2026-07-13

### Fixed
- **FAB open animation flashed a hard square.** The floating action button's
  circle→squircle morph animated `border-radius` from the pill value (999px)
  with the overshooting spring, which drove the interpolated radius negative
  at the overshoot peak — painting a momentary sharp square before it settled.
  It now morphs from the true circle radius (28px) with a low-overshoot soft
  spring, so it stays rounded the whole way.

## [1.16.0] — 2026-07-13

### Added
- **Expressive motion — the app now feels physical and native.** Motion moved
  from flat ease-out to a restrained, one-overshoot **spring** (the Material 3
  Expressive direction), so interactions settle with a little life instead of
  snapping. Spring easings are built as CSS `linear()` curves (no animation
  library), and everything still fully honours `prefers-reduced-motion`.
  - The **FAB menu** items spring up in a stagger, and the button **morphs**:
    the circle becomes a squircle and the "+" rotates 45° into a close "×".
  - **Bottom sheets** spring up as they open.
  - The **bottom nav** now has a single indicator pill that slides between
    tabs, with the active icon filling and lifting.
  - **Checking off an item** gives a quick "pop" before it shrinks and re-sorts
    into "Nylig kjøpt".
  - Buttons and the icon buttons get a springy press.
- **More haptics, coupled to motion** (respecting the existing haptics toggle):
  a light tick on switching tabs, opening the FAB menu, and picking one of its
  actions — on top of the existing add / check-off / delete feedback.
- **Emphasized headings** — screen titles use a larger, heavier Material 3
  Expressive "emphasized" type style so they carry a bit more personality.

## [1.15.0] — 2026-07-13

### Added
- **A real Material FAB menu.** Tapping the "+" on the shopping list and
  meal-plan tabs no longer opens a pop-up dialog — it now expands a proper
  Material 3 FAB menu (speed-dial): the button morphs to a close "×", a scrim
  fades in, and the labelled actions rise in a stack above it. Shopping list:
  "Fra middagsplanen" and "Forslag"; Måltider: "Nytt måltid" and "Rediger
  måltider". Tap an action, the scrim, the button again, or press Esc to close.
- **Material state layers** on the `Button`, `IconButton` and floating action
  button — a subtle tonal wash on hover/press, layered on top of the existing
  darken-and-scale press "give" and the Android tap ripple.

### Changed
- **Material 3 design refresh.** The design system's tokens were migrated to a
  full Material Design 3 system: colours are now an M3 tonal-palette + role-token
  scheme (warm terracotta / sage / mustard / neutral source colours), on the M3
  type scale, shape scale and elevation levels, with M3 state-layer opacities.
  Every existing `--text-*` / `--radius-*` / `--shadow-*` / `--accent-*` name is
  kept as an alias onto the new roles, so the app stays the same warm brand — now
  built on M3 foundations. Dark mode was rebuilt as a proper M3 dark scheme (the
  source design project is light-only).

## [1.15.0] — 2026-07-13

### Added
- **Real offline app-shell caching.** `public/sw.js` previously registered a
  service worker that only satisfied the PWA install criteria and passed
  every request straight to the network. It now caches the app shell
  (stale-while-revalidate) so the app loads offline; `/api/*` and `/seed`
  requests are always excluded and still hit the network directly.

### Fixed
- **Modals now close on Escape.** None of the four modals (item detail,
  meal, admin, etc.) responded to the Escape key — only the dimmed backdrop
  or an explicit close button worked, which could read as the app being
  stuck. A single `keydown` listener in the shared `Sheet` component now
  closes whichever modal is open.

## [1.14.0] — 2026-07-13

### Changed
- **Shopping list FAB now leads with the meal plan.** Tapping the "+" opens a
  chooser: the primary action, **"Fra middagsplanen"**, pulls every
  ingredient from this week's (Mon–Thu) or next week's (Fri–Sun) planned
  meals into a checkable list — pick what you need and add it in one go.
  The date range and which week is shown is labelled at the top. The old
  "Sannsynligvis tom for" recommendations are still there, now as the
  secondary option in the same menu.

## [1.13.0] — 2026-07-12

### Added
- **Android Material tap ripple** on every primary tappable control — the
  `Button`, `IconButton` and the floating "+" action button (FAB) now show a
  brief circular ripple spreading from the point you tapped, layered on top of
  the existing darken-and-scale press "give". This is the design system's
  signature Android touch feedback (see `src/design-system/lib/useRipple.jsx`),
  which had been dropped when the components were first ported.
- **`danger` button variant** — a clear red-outline destructive style used for
  all "delete/remove" actions.

### Changed
- **Redesigned the delete buttons.** The "Slett vare fra katalog", "Slett
  måltid fra katalog" and member "Fjern" actions were previously a plain grey
  cancel button with red text, which read as disabled rather than destructive.
  They're now proper `danger`-variant buttons (red outline + trash icon) that
  fill red on press.
- The two FABs (shopping list, meal plan) and the meal-plan FAB menu now use
  the shared design-system `Fab`/`Button` components instead of one-off inline
  markup, so they share the same press/ripple behaviour as the rest of the app.

## [1.12.8] — 2026-07-12

### Fixed
- **Fixed being logged out on every fresh app load.** `AuthProvider` wired up
  `api.js`'s token getter inside a `useEffect`, but child providers (e.g.
  `ListUsersProvider`) fire their own mount-effect API calls, and React runs
  child effects before parent effects. That meant the very first request(s)
  after any fresh mount — including reloading via the "new version available"
  toast — went out with no token, got a real 401 back, and logged out an
  otherwise perfectly valid session. The token getter is now wired up
  synchronously during `AuthProvider`'s render instead, so it's in place
  before any child component renders or fires effects.

## [1.12.7] — 2026-07-12

### Added
- **App mark on the "Om" (About) settings page.** The redesigned app icon
  was live everywhere except the one in-app screen where a small brand mark
  is conventional (an "about" page, alongside the version number) —
  `AboutSettings.jsx` now shows the same mark used on the login screen,
  centered above the version row.

## [1.12.6] — 2026-07-12

### Changed
- **Brought the login screen and landing page in line with the redesigned app
  icon.** 1.12.5 redesigned the installable app icon into a bold ring-and-
  handle glyph but left the login screen's mark
  (`src/design-system/assets/logo/panhandle-mark.svg`, imported by
  `LoginScreen.jsx`) and the marketing landing page's inline copy
  (`public/index.html`) on the old thin-ring design, so the app briefly had
  two different logos live at once. Both now use the same bold ring-and-
  handle silhouette (terracotta on transparent, sized for a light
  background instead of the icon's full-bleed tile). Also refreshed the two
  matching dormant assets (`panhandle-mark-dark.svg`, `panhandle-wordmark.svg`)
  that aren't currently wired into the app, so they don't sit around
  contradicting the new design if they get used later.

## [1.12.5] — 2026-07-12

### Changed
- **Redesigned the app icon for Android's adaptive-icon treatment**, inspired
  by TickTick's bold, high-contrast style. The old icon (a small terracotta
  pan floating on a cream background, with a thin low-opacity highlight ring)
  shrank to an illegible smudge once Android's launcher masked and scaled it
  down. Replaced it with a single new source
  (`src/design-system/assets/logo/panhandle-icon.svg`): a full-bleed solid
  terracotta square with a bold cream pan-and-handle glyph sized to fill most
  of the frame while staying inside the maskable safe zone. All three
  manifest icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`)
  now render from this one design (opaque background, no transparency) so
  there's no more separate crop logic to drift out of sync — it reads clearly
  at both full size and 48px launcher scale, and holds up under a circular,
  squircle, or square mask alike. The in-app login/nav mark
  (`panhandle-mark.svg`) is unchanged.

## [1.12.4] — 2026-07-11

### Fixed
- **App icon was off-center with the handle clipped off.** The 1.12.3 crop
  used `position:absolute; top:50%; transform:translateY(-50%)` to center the
  mark, which a Chromium rendering quirk resolved ~44px too high on a 512px
  canvas — invisible on a laptop screen, but glaring once cropped into
  Android's adaptive-icon shape (the handle got clipped at the mask edge).
  Recomputed the mark's position with absolute pixel offsets instead of
  percentage+transform, and pulled `icon-maskable-512.png`'s content in
  further (~53% of the safe-zone radius) so it sits safely inside Android's
  circular/squircle crop with margin to spare.

## [1.12.3] — 2026-07-11

### Fixed
- **App icon had the wrong crop and an unwanted background.** The regenerated
  icons in 1.12.2 kept the source mark's original margin (sized for sitting
  next to text on the login screen, not for filling an icon frame) and baked
  in a solid cream background on the `any`-purpose icons. Recropped
  `icon-192.png`/`icon-512.png` tightly around just the pan shape and made
  their background transparent; `icon-maskable-512.png` keeps its opaque
  background (required for adaptive icons) but now uses the same crop.

## [1.12.2] — 2026-07-11

### Fixed
- **Android install was still falling back to a plain shortcut.** All three
  manifest icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`)
  had corrupted PNG data (bad IDAT chunks, likely from a line-ending
  normalization pass at some point) ever since the React rewrite — a valid
  manifest and service worker weren't enough, since Chrome's installability
  check also requires a decodable icon. Regenerated all three from the
  existing brand mark (`src/design-system/assets/logo/panhandle-mark.svg`,
  the same one used on the login screen). Added `.gitattributes` marking
  image/font types as binary so this can't silently recur.

## [1.12.1] — 2026-07-11

### Fixed
- **Item icons were invisible.** The catalogue icon SVGs are drawn in white
  stroke (meant to sit on a solid colored tile, as in the old vanilla app),
  but the React rewrite's badge circle used a pale cream background
  (`--surface-sunken`), making every icon effectively invisible, and never
  ported the old app's explicit icon sizing CSS, so icons had no width/height
  and could overflow their badge. Badges (list and grid view) now use a solid
  `--accent-secondary` (sage) background with correctly sized icons.

## [1.12.0] — 2026-07-10

### Added
- **Motion, so the app feels native.** Shared motion tokens
  (`src/design-system/tokens/motion.css`: durations, ease-out easing, press
  scale) now back all animation, kept in sync with the Panhandle Design System
  project.
- **Checking off an item now animates.** Instead of instantly vanishing, a
  ticked-off item strikes through and fills its checkbox in place, then briefly
  fades and shrinks out before re-sorting into "Nylig kjøpt" — the quick
  strike-through + fade the design language calls for (no celebratory
  animation, no artificial blocking delay). The reorder is driven locally, so
  the timing no longer depends on the network round-trip. Applies to both list
  and grid view.
- **Bottom sheets now slide up** with a fading scrim when opening, instead of
  popping in.
- **Touch press feedback**: buttons give a light physical "shrink" on tap
  (pointer-based, so touch taps get it too, without sticky hover afterwards).
- Honors `prefers-reduced-motion`.
- **Installable as an app again on Android.** Added a minimal service worker
  (`public/sw.js`, registered from `main.jsx`) so Chrome offers the real
  "Install app" (standalone WebAPK) path instead of only "Add to home screen".
  It's a no-cache network passthrough — no offline shell yet (that's a separate
  follow-up), and no risk of serving a stale app after a deploy.

### Changed
- The Settings menu rows are rebuilt on design-system tokens with a real
  Phosphor caret, matching the card look of the other tabs (replacing the
  hand-drawn CSS chevron).
- Dropped the stray emoji from the "Alt er handlet" shopping-list summary, per
  the design system's no-emoji-in-chrome rule.

## [1.11.0] — 2026-07-10

### Changed
- **New visual design**, built from the "Panhandle Design System" Claude
  Design project: warm-paper/terracotta/sage palette, Instrument Sans +
  Caveat type, Phosphor icons, and generously-rounded pill-shaped
  components. The design system's tokens and component library
  (Button, Card, ListItem, Header, TabBar, Sheet, Input, Checkbox, Switch,
  Tag, Avatar, Badge, IconButton) are imported into the repo under
  `src/design-system/` and used to rebuild the shopping list, meal plan,
  navigation, login screen, and modals. A dark-mode palette (not part of
  the source design, which is light-only) was authored to extend the
  app's existing light/dark/system theme toggle. New PWA icons and
  manifest colors adopt the same brand. The hand-drawn per-grocery-item
  icon set and the flat nav icon set's *mapping* stay — nav/chrome icons
  now render via Phosphor instead of bundled inline SVG. No functional
  changes: same features, same data, same API.

## [1.10.0] — 2026-07-10

### Changed
- **Frontend rewritten in React**, built with Vite. Replaces the hand-rolled
  vanilla JS/HTML single-file app (`public/app.html`) with a component-based
  app under `src/`, built to `dist/` and deployed by Cloudflare Pages via
  `npm run build`. All three tabs (Handleliste, Måltider, Innstillinger) are
  fully ported, plus the deploy-version-drift toast, PWA install prompt, and
  browser back-button navigation for tabs/settings. No user-facing behavior
  changes are intended — this is an internal rewrite of the same app.
- The hand-drawn item icon library and flat UI icon library
  (`itemIcons.js`/`uiIcons.js`) are now plain ES modules under `src/lib/`
  instead of scripts attached to `window`.

### Known gaps vs. the previous frontend
  Swipe-to-toggle and long-press-to-edit gestures, the per-card resolve
  animation, and back-button support *within* modals aren't ported yet —
  see the React port PRs (#76, #77) for details.

## [1.9.2] — 2026-07-07

### Fixed
- Item-marking animation: toggling one item while another item's mark-as-bought
  animation was still playing could interrupt the in-progress animation with a
  visual flicker (a full list re-render on the first toggle's completion would
  wipe the second item's in-flight animation state). The list is now aware of
  which items are still mid-animation and preserves that state across re-renders.

## [1.9.1] — 2026-07-07

### Fixed
- List view: item name text now lines up vertically with its icon/badge for
  items with no quantity or notes (the common case) — a reserved-but-empty
  notes line was pushing the name text above the badge's center.

## [1.9.0] — 2026-07-06

### Added
- **Fast ukentlig ansvar**: set a default responsible person per day of the week
  (Settings → "Fast ukentlig ansvar"). The default is shown in muted italics on
  unplanned days in the meal plan, and pre-fills the responsible dropdown when
  adding a new meal. It's always overridable for any individual day.
- **Annet** option in the responsible dropdown (meal modal): select "Annet..."
  to type a custom label such as "Ute og spiser" or "Gjester lager mat". If
  left blank, the value is saved as "Annet".

## [1.8.1] — 2026-06-22

### Added
- A brief shrink/fade animation on a shopping item when it's marked
  purchased or un-marked from "Nylig kjøpt", so toggling no longer just
  teleports the row from one place to another.

## [1.8.0] — 2026-06-20

### Added
- A "Vibrasjon ved handling" toggle in Profil settings to turn haptic feedback
  on/off (default on); short vibration on checking off, adding, or deleting an
  item.

### Fixed
- Swiping down at the top of a list no longer triggers the browser's native
  pull-to-refresh (full page reload) — content scrolling now contains the
  overscroll instead of bubbling up to the page.
- The header, bottom tab bar, floating add button, and toast now respect the
  device's notch/gesture-bar safe areas instead of running underneath them.
- Added iOS web-app meta tags (`apple-mobile-web-app-capable` etc.) for a
  cleaner standalone/install experience on iOS.

## [1.7.0] — 2026-06-20

### Added
- Auto-refresh prompt for app updates: while a tab stays open, it now polls
  the live Worker version every 60s (and right when the tab regains focus)
  and shows a toast with an "Oppdater" button the moment a new deploy lands,
  instead of only detecting it on the next fresh page load. Never reloads on
  its own, so an in-progress edit isn't lost.

## [1.6.2] — 2026-06-20

### Fixed
- The dropdown arrow on the meal-planning "Måltid" field didn't open anything
  when clicked (an `<input list>` datalist's native arrow indicator is
  unreliable across browsers). Replaced it with a custom dropdown that
  reliably opens on click or focus and filters as you type.

## [1.6.1] — 2026-06-20

### Added
- Free-form labels on meals (e.g. "Middag", "Vegetar") — add them in the meal
  editor with autocomplete from labels already used in the catalogue, shown as
  chips in "Alle måltider", and filterable there via a label dropdown.

## [1.6.0] — 2026-06-20

### Added
- Purchase-frequency tracking on `item_catalogue` (`times_bought`,
  `first_bought`, `last_bought`, bumped on the toggle-to-bought transition) and
  a `GET /catalogue/suggestions` endpoint that recommends items you're
  probably out of, ranked by how overdue they are against their own average
  purchase interval. Surfaced via a badge on the shopping tab's FAB — tapping
  it opens a "Sannsynligvis tom for" sheet to add suggested items with one tap,
  falling back to the regular add-input shortcut when there's nothing to
  suggest.

## [1.5.0] — 2026-06-20

### Added
- A "what's new" toast the first time a device opens the app after a new
  version has been deployed, with a button that opens a changelog modal
  showing this file's contents. Also reachable any time from Innstillinger →
  Om → "Hva er nytt?". The changelog is now also copied to
  `public/CHANGELOG.md` so Cloudflare Pages can serve it as a static asset
  for the frontend to fetch.

## [1.4.2] — 2026-06-20

### Removed
- The "Sorter liste" pill on the Handleliste tab — it toggled an alphabetical
  sort within each category, but the toggle's visual state and effect were
  unreliable enough that it read as broken. Removed the button along with
  `sortMode`/`toggleSort` and the now-dead `.pill` CSS; the list always
  renders in default category order.

## [1.4.1] — 2026-06-20

### Fixed
- The Android/browser back button did nothing sensible inside the app (no
  `history` integration existed at all) — pressing it while a modal was open,
  mid-drill-down in Innstillinger, or on the Måltider/Innstillinger tab just
  exited the standalone PWA instead of stepping back one level. Tab switches,
  settings drill-down (main ↔ profile/medlemmer/administrasjon/om), and every
  modal now push a `history` entry, so back closes the modal / returns to the
  previous subpage or tab first, matching what a user expects. Escape now also
  closes an open modal.

## [1.4.0] — 2026-06-20

### Changed
- Renamed the "Profil" tab to "Innstillinger" (Settings) and restructured it
  into a category list — Profil, Medlemmer (owner-only), Administrasjon
  (admin-only), and Om — each its own drill-down subpage instead of one long
  scrolling page. No functionality changed, only how it's organized: account
  info/theme/password/logout live under Profil, list-member management moved
  from an inline panel to its own Medlemmer subpage, and the version number
  moved to a new Om subpage.

## [1.3.0] — 2026-06-20

### Added
- The Måltider tab's FAB now opens a small chooser ("Nytt måltid" / "Rediger
  måltider") instead of going straight to the new-meal editor — editing an
  existing meal is just as common a reason to tap it.
- The new-meal/edit-meal modal now flags name collisions as you type: an
  exact (case-insensitive) match against another meal shows an error and
  blocks saving early (mirroring the server's own duplicate check), and a
  substring match against another meal's name shows a "Ligner på: …" hint
  so near-duplicates are caught before they're saved.
- A FAB on the Handleliste tab — for now it just jumps focus to the add bar;
  a fuller quick-add flow may follow.

## [1.2.1] — 2026-06-20

### Changed
- "+ Nytt måltid" moved off the Måltider tab's header (where it was a small,
  easy-to-miss text link) onto a floating action button anchored bottom-right
  of the tab, above the nav bar — matching the prominence a primary "add" action
  warrants. The header now only has the "Alle måltider ›" link; its own
  "+ Nytt måltid" button (inside that browse modal) is unchanged.

## [1.2.0] — 2026-06-19

### Added
- A meal editor: "+ Nytt måltid" (header of the Måltider tab, and inside
  "Alle måltider") adds a meal to `meal_catalogue` with its ingredients
  without assigning it to a day. Clicking any row in "Alle måltider" opens
  the same editor to rename a meal, edit its ingredients, or delete it from
  the catalogue entirely (`POST /api/meals`, `PATCH /api/meals/:id`,
  `DELETE /api/meals/:id`) — previously meals could only be created/edited
  implicitly by planning a day.

## [1.1.0] — 2026-06-19

### Added
- Meal suggestions: `meal_catalogue` now tracks `times_planned`/`last_planned`
  per meal (migration `0004_meal_usage_stats.sql`), and the meal-planning
  modal shows quick-pick chips (`GET /api/meals/suggestions`) for meals eaten
  often but not in the last 10 days.
- "Alle måltider" — a read-only, filterable browse view of every saved meal
  with its usage stats, opened from the Måltider tab.

## [1.0.19] — 2026-06-19

### Added
- A manual "Installer app" row on the Profile page that works even when the
  browser's `beforeinstallprompt` event never fires (it only fires under
  browser-specific heuristics, and stops firing after repeated dismissals or
  an uninstall — previously this left no way to install). Shows an install
  button when the browser-native prompt is available, otherwise shows
  platform-specific manual instructions (iOS Safari vs. other browsers).
  Placed next to the theme toggle so account info, preferences, owner/admin
  actions, security and logout stay in clean logical groups.

## [1.0.18] — 2026-06-19

### Changed
- Meal names typed into the meal planner are now capitalised on save too, using
  the same `capitalizeName` helper as item names (1.0.17 covered items but not
  meals). A meal entered as "taco" is stored "Taco". Lookups stay
  case-insensitive, so existing meal names are unaffected.

## [1.0.17] — 2026-06-19

### Changed
- Item names are now always capitalised. New catalogue names are saved with a
  capital first letter on the server (`capitalizeName`, applied on add and on
  rename), and the frontend capitalises every place an item name is shown
  (list, grid, recent, the edit modal, suggestions, meal-ingredient picker and
  toasts) via a `cap()` helper — so even legacy lowercase rows never display
  uncapitalised. The rest of the name is left as typed, so proper nouns,
  acronyms and casing like "7 Up" are preserved.

## [1.0.16] — 2026-06-19

### Added
- Gluten-free shorthand: adding an item with a `GF`, `gf` or `glutenfri` marker
  in its name (e.g. "Pasta GF") now files it under the normal catalogue name
  ("Pasta") with a "Glutenfri" note instead of creating a separate "Pasta GF"
  catalogue entry. The note always reads "Glutenfri" regardless of how the
  marker was typed. The plain item and its gluten-free variant coexist as two
  distinct lines — the add-merge check is now notes-aware, so one no longer
  bumps the other's quantity. Handled authoritatively in the Worker, with the
  frontend mirroring it for catalogue matching, suggestions and toasts.

## [1.0.15] — 2026-06-19

### Changed
- Shopping list: the "N varer igjen" count now shares a row with the list/grid
  view-toggle buttons (count on the left, toggle on the right) instead of
  sitting on its own line below them.

## [1.0.14] — 2026-06-19

Completes Phase 4 / the UX improvement plan. (T15, multiple meals per day, was
intentionally skipped — keeping one meal per day; it would have needed a schema
migration.)

### Added
- T21: Dark mode, with a Lys / Mørk / Følg systemet control in the Profile
  (defaults to following the OS). The theme is applied before the stylesheet to
  avoid a flash, and the PWA status-bar colour tracks the effective theme. The
  dark palette keeps the greens (which carry white text on any background) and
  flips only the neutral surfaces/text; `--accent-text` was decoupled from
  `--accent` so accent-coloured text stays readable on dark surfaces.

## [1.0.13] — 2026-06-19

Phase 4 (partial) of the UX improvement plan (`docs/ux-improvement-plan.md`):
look & feel. (T21, dark mode, is deferred — the palette has variables doing
double duty as both background and text, so it needs careful per-usage
decoupling and visual QA rather than a blind variable swap.)

### Changed
- T19: Darkened `--muted` (#8B7D6E → #6E6253) so secondary labels and the
  struck-through "bought" text meet AA contrast.
- T22: The Profile now shows a plain version number; the app-vs-API mismatch
  detail (deploy debugging) moved to the Admin subpage.

## [1.0.12] — 2026-06-19

Phase 3 (partial) of the UX improvement plan (`docs/ux-improvement-plan.md`):
recent-list and meal-planner polish. (T15, multiple meals per day, is deferred —
it needs a schema migration.)

### Added
- T17: A "N varer igjen" summary above the shopping list (and "Alt er handlet 🎉"
  when nothing's left).

### Changed
- T13: "Nylig kjøpt" now starts collapsed (still toggleable, choice remembered)
  and renders at most the 30 most-recent bought items, so the history can't grow
  unbounded.
- T14: The meal planner can now look up to 4 weeks ahead (still 1 week back) for
  planning further out.
- T18: The add-item field now hints the quantity shorthand in its placeholder
  ("Legg til vare – f.eks. «2 melk»").

## [1.0.11] — 2026-06-19

Phase 2 of the UX improvement plan (`docs/ux-improvement-plan.md`): the core
meal → shopping list connection — the app's headline promise, finally wired up.

### Added
- T1: From the meal modal, a "+ Legg ingredienser på handlelisten" button opens
  a picker of the meal's ingredients. The user chooses which to add; ingredients
  already on the active list are shown but left unchecked, the rest are
  pre-checked. Selected items are added (resolved to their catalogue name +
  category) and a toast confirms how many landed. The meal is saved first so its
  ingredients are remembered.
- T16: A note in the meal modal clarifies that ingredients are stored per meal
  name and shared across every date that meal appears on.

## [1.0.10] — 2026-06-19

Phase 1 of the UX improvement plan (`docs/ux-improvement-plan.md`): shopping
list reliability. Added a toast/snackbar mechanism and split list fetching from
rendering (`loadList` → `renderList`) so updates can apply instantly.

### Added
- T2: Optimistic UI — checking off and deleting items update the screen
  immediately and reconcile with the server in the background (with revert on
  failure). View/sort/collapse changes now re-render from cache without a
  round-trip.
- T4: Undo on delete — items are removed instantly with a 5-second "Angre"
  toast; the server delete only commits after the grace window, and polling
  can't resurrect a row mid-undo.
- T5: Adding an item that's already on the list now shows a toast explaining
  the quantity was increased (the API already merged it).
- T3: Failed adds/toggles/deletes now surface a toast and keep the typed text,
  instead of silently appearing to succeed.

### Changed
- T6: An expired/invalidated session now explains itself on the login screen
  ("Økten utløp …") instead of silently bouncing to login.

### Fixed
- Tapping the icon inside a card's edit/delete button no longer also toggles
  the item's bought-state (`closest()` guard).

## [1.0.9] — 2026-06-19

Phase 0 of the UX improvement plan (`docs/ux-improvement-plan.md`): quick,
low-risk frontend wins.

### Added
- T9: Show/hide password toggle on the login screen and both change-password
  fields.
- T8: Login button now shows a "Logger inn..." state and is disabled while the
  request is in flight, preventing double-submit.
- T20: `aria-label`s on icon-only buttons (add, list/grid view toggle, card
  edit/delete, install-banner dismiss).

### Changed
- T12: Re-enabled pinch-to-zoom (removed `maximum-scale=1.0, user-scalable=no`
  from the viewport meta) for accessibility.
- T7: Pressing Enter in the username or password field now submits the login.
- T11: Clarified the "Slett vare fra katalog" confirmation — it removes the
  item from this list's saved items (no longer suggested) and only affects this
  list. Also corrected a stale code comment that claimed the delete was global.

## [1.0.8] — 2026-06-19

### Fixed
- TODO #2: Polling (`/list`/`/plan`, every 7s) kept running while the tab
  was backgrounded, and `showApp()` never cleared a prior interval before
  starting a new one, risking stacked timers. The poll tick now skips work
  when `document.hidden`, `showApp()` clears any existing timer first, and
  a `visibilitychange` listener triggers an immediate refresh on returning
  to the tab so data isn't stale.

## [1.0.7] — 2026-06-19

### Fixed
- Long-press to open the item modal in grid view didn't work on touch
  devices: the timer was canceled on any `pointermove`, and touch input
  always reports a few pixels of jitter even when held still. Grid view
  now tolerates movement up to a 10px threshold before canceling, matching
  list view's existing behavior.

## [1.0.6] — 2026-06-19

### Added
- TODO #6: Item modal now allows renaming the catalogue entry itself
  (`PATCH /list/:id` accepts `name`) and deleting it from the catalogue
  entirely (new `DELETE /list/:id/catalogue`, cascades to every
  `list_items` row referencing it).
- TODO #7: Autocomplete suggestions now include an explicit "Legg til
  «...» nøyaktig som skrevet" option that adds the raw input as-is,
  bypassing catalogue matching and quantity parsing entirely.

### Fixed
- TODO #5: Autocomplete suggestions dropdown is now dismissed on any
  click outside the add bar, instead of lingering over other UI.
- TODO #7: `parseItemInput` no longer treats a *trailing* number as a
  quantity (e.g. "milk 2" no longer gets split into "milk" x2) — only the
  unambiguous leading "<qty> <name>" form is parsed that way.

## [1.0.5] — 2026-06-18

### Added
- TODO #9: Meal plan now has an "Ingredienser" field (comma-separated) in
  the meal-edit modal, stored as a JSON array on
  `meal_catalogue.ingredients` and shared across every occurrence of that
  meal name. Picking a known meal name auto-fills its stored ingredients.

### Fixed
- TODO #18: `parseItemInput` no longer strips a leading/trailing number
  from text that's an exact match for an existing catalogue item, so a
  product name containing a number isn't mis-split into name+quantity.
- TODO #19: New shopping-list items are stored as typed instead of being
  force-uppercased, matching the Title Case of the seeded catalogue.
- TODO #24: Removed the Worker's inline, stale copy of the seed-account
  form; `/seed.html` now serves only from `public/seed.html` via the
  existing Pages proxy.

## [1.0.4] — 2026-06-18

### Fixed
- TODO #14: Login rate-limiting — `/login` now tracks failed attempts per
  source IP in a new `login_attempts` D1 table (migration
  `0007_login_attempts.sql`) and returns 429 after 10 failures in a
  15-minute sliding window. Keyed by IP rather than username so flooding a
  known account's login can't lock out its real owner. Requires running
  `npx wrangler d1 migrations apply panhandle --remote` before this lands.
- TODO #16: `--green` / `--danger` CSS variables were referenced by the
  change-password button/messages but never defined in `:root`, so the
  button had no background and messages had no colour. Both vars are now
  defined.

## [1.0.3] — 2026-06-18

### Changed
- Profile page: moved "Varer i katalog" and "Måltider i database" into the
  admin-only Administrasjon subpage (they're internal/operational figures,
  not relevant to regular members). Removed the hardcoded "Synkronisering:
  Hvert 7. sekund" row — it was a non-actionable, easily-stale label for an
  internal implementation detail (the poll interval).

## [1.0.2] — 2026-06-18

### Changed
- Meal plan no longer keeps long-term history: week navigation is clamped to
  last week / this week / next week (`weekOffset` in `[-1, 1]`, with the
  "Forrige"/"Neste" buttons disabling at the edges), and `GET /plan`
  opportunistically deletes `meal_plan` rows older than 14 days on every
  read. `meal_catalogue` (the reusable meal names) is untouched.

## [1.0.1] — 2026-06-18

### Fixed
- Meal-plan date off-by-one: the week grid, "today", and the saved
  `plan_date` were formatted with `Date#toISOString()`, which converts to UTC
  first — between local midnight and the UTC offset (00:00–02:00 in
  UTC+1/+2) the whole week view, "today", and what got saved all silently
  shifted back a day. Now formatted from local date components instead.

## [1.0.0] — 2026-06-18

First tagged version. Establishes versioning for the already-live app; captures
the feature set shipped to date.

### Added
- Shared shopping list with a catalogue-backed autocomplete, per-category
  grouping, quantity + notes, list and grid views, swipe-to-buy, and an item
  detail modal.
- Meal planner with a Monday–Sunday week view, any-week navigation, and an
  assigned-responsible person per day.
- Accounts and auth: PBKDF2 password hashing, hand-rolled HS256 JWTs with
  token versioning, sliding expiry on every authenticated response, and an
  in-app password change that logs out other devices.
- Multi-tenant model (`0005_multi_tenant.sql`): per-list data isolation with
  independent `is_admin` / `is_owner` flags, admin-created owner lists, and
  owner-managed members.
- Catalogue seeds: `0004_seed_catalogue.sql` (~506 Norwegian items) and
  `0006_expand_catalogue.sql` (+200, ~706 total), both non-destructive upserts.
- PWA install prompt, emoji/SVG item icons, and a one-time credential/invite
  dialog for newly created accounts.
- `GET /api/version` endpoint and a Profile-page version readout.

[1.0.0]: https://github.com/SpaceSphereWheatley/panhandle/releases/tag/v1.0.0

---

## About this file

All notable changes to Panhandle are recorded here. The version is duplicated
and bumped together on each release:

- `worker/index.js` → `const VERSION`
- `src/lib/version.js` → `APP_VERSION` (the live frontend, as of 1.10.0 — see above)

`public/app.html`'s own `APP_VERSION` constant is no longer live (superseded by
the React app built from `src/`) but is left in place for now; it isn't served
by Cloudflare Pages anymore, so it's not part of the bump going forward.

The Profile page reads `GET /api/version` and shows both the app (Pages) and API
(Worker) versions, so a deploy where only one half landed is visible at a glance.

Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this
project uses simple `MAJOR.MINOR.PATCH` numbers (see CLAUDE.md's Versioning
section for the bump convention).
