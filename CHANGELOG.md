# Changelog

## [1.42.2] — 2026-07-23

### Changed
- **Innstillinger ser likt ut hele veien.** Øverst på innstillingssiden lå
  utseende-valgene (tema, design og vibrasjon) rett i lista, mens alt annet
  åpnet sin egen side når du trykket. Nå åpner også utseende sin egen side,
  «Utseende», så hele innstillingssiden er én ryddig liste der hvert valg
  fungerer likt. Valgene er samlet under «Meg» (din enhet og konto) og
  «Husstanden» (det dere deler).

## [1.42.1] — 2026-07-23

### Fixed
- **"Hva er nytt" text is left-aligned again from Settings.** Opening the
  changelog from Settings' "Hva er nytt?" link centered the version headings
  and bullet text (while the bullet markers themselves stayed put on the
  left), because the dialog inherited centered text from the footer it was
  triggered from. All dialogs now always render left-aligned text regardless
  of where they're opened from.

## [1.42.0] — 2026-07-23

### Changed
- **Innstillinger er pusset opp.** Hele innstillingssiden er ryddet så knapper,
  brytere, felt og lister ser like ut fra side til side, med et roligere og mer
  konsekvent uttrykk. "Logg ut" skiller seg ikke lenger ut som en hovedknapp,
  og navnet ditt lagres nå automatisk når du forlater feltet.
- **"Gamle varer"-innstillingen er flyttet.** Valget for hvor lenge en vare kan
  ligge ukjøpt før den får en diskré markering, ligger nå under "Butikkoppsett"
  sammen med de andre handleliste-valgene, i stedet for under "Varsler" der det
  egentlig ikke hørte hjemme.
- **Tydeligere på hvem varsler gjelder.** Varsler-siden viser nå at det å slå på
  push-varsler gjelder kun din egen enhet, mens påminnelsene om middagsplanlegging
  gjelder hele husstanden.

## [1.41.1] — 2026-07-23

### Fixed
- **Settings no longer strands you on the wrong tab.** Drilling into a Settings
  sub-page (like Butikkoppsett or Varsler) and then switching to another tab
  before coming back could break the back button — tapping it, or the browser's
  back gesture, would dump you on an unrelated tab instead of the Settings list.
  Back navigation now always returns you to the Settings list correctly.
  Tapping the Innstillinger tab icon again while inside a sub-page also now
  jumps straight back to the Settings list.

## [1.41.0] — 2026-07-23

### Added
- **Arrow-key navigation for add-item suggestions.** When you type in the
  "Legg til vare" box, you can now press ↑/↓ to move a highlight down the
  suggestion list and hit Enter to add whichever one is highlighted, instead
  of having to reach for the mouse or type the name out exactly.
- **Drag-to-reorder store categories.** You can now drag the shopping-list
  categories into place instead of only nudging them one step at a time with
  up/down buttons. The settings page for this is also renamed from "Butikk"
  to "Butikkoppsett" so it's clearer what it's for.

### Fixed
- **New common grocery items now reach every existing household
  automatically,** within about 15 minutes of a deploy, instead of requiring
  a separate manual database step — no visible change to how the app works.

## [1.40.0] — 2026-07-23

### Added
- **Match the list to your store.** You can now set the order of the item
  groups (fruit & veg, dairy, household…) to follow your own store's layout,
  under Innstillinger → Butikk. The shopping list then sorts itself along the
  route you actually walk, so you're not backtracking across the shop. It's a
  shared setting for the whole household.
- **"Tøm handlede" — clear everything you've bought in one tap.** When you're
  done shopping, a new button on the "Nylig kjøpt" section wipes all the
  checked-off items at once, instead of removing them one by one. The items
  themselves are remembered, so they still show up in search and suggestions
  next time.

## [1.39.1] — 2026-07-22

### Fixed
- **No more double notification on a quiet Sunday.** When the whole upcoming
  week had no meals planned, you could get two reminders back-to-back on
  Sunday evening — the weekly "plan next week" nudge and the daily "nothing
  planned for tomorrow" one. Now only the weekly reminder is sent in that case.
- **The "important only" filter turns itself off once everything important is
  bought,** instead of staying silently armed and re-engaging the next time you
  star an item.
- **Picking a reminder time now snaps to the nearest quarter-hour.** Typing an
  odd minute like 18:07 on a computer used to be silently rejected with an
  unhelpful error; it's now rounded to a valid time (e.g. 18:00) and saved.
- **The "from the meal plan" add no longer overcounts.** Ingredients already on
  your list are no longer counted as newly added in the confirmation message.
- A display name now resolves regardless of letter case, and some unused
  notification code was cleaned up — no visible change from either.

## [1.39.0] — 2026-07-22

### Added
- **Items you add or check off with no signal are no longer lost.** If you
  add an item or tick one as bought while offline — mid-shop in a dead spot,
  say — it's now saved on your device and sent automatically the moment
  you're back online, instead of quietly disappearing. A small counter next
  to the item summary shows how many changes are still waiting to sync.

## [1.38.1] — 2026-07-20

### Fixed
- **Saving a meal plan day no longer loses the other half of it.** Updating
  just who's responsible for a day could previously blank out the meal
  planned for it, and updating just the meal could previously blank out who
  was responsible — both are now preserved unless you actually change them.
  This wasn't reachable from the app's own screens (they always send both
  together), but closes the gap for any future partial save.

## [1.38.0] — 2026-07-20

### Fixed
- **"Legg til nøyaktig som skrevet" now actually adds it exactly as typed.**
  Previously, an item containing "gf" or "glutenfri" still got that marker
  stripped out and a "Glutenfri" note added even when you chose the
  "add exactly as written" option — it wasn't truly verbatim. That option
  now saves the name untouched, with no automatic capitalization either.

### Added
- **Quantities with units are now recognized when adding an item.** Typing
  something like "2L melk", "500g ost", "2 kg poteter", or "3 stk egg" now
  splits into the right quantity and item name, with the unit kept as a
  note on the item — instead of the unit riding along as part of the name.

## [1.37.3] — 2026-07-20

### Fixed
- **Admin actions are now confined to your own household.** Resetting a
  password, changing someone's admin/owner access, and viewing the user
  list from the Administrasjon screen now only reach people in your own
  list, instead of every household in the app. Creating a brand-new
  household from that screen is now limited to the app owner. This closes
  a latent cross-household access gap that only mattered once a second
  household gets an admin — nothing changes for the current single-admin
  setup.

## [1.37.2] — 2026-07-20

### Changed
- **Internal housekeeping only — nothing changes in the app.** Logged a fresh
  round of audit findings and future ideas in the project's own to-do notes.
  No user-facing behaviour was touched; the version bump is just to keep the
  deploy and changelog in step per the release convention.

## [1.37.1] — 2026-07-19

### Changed
- **Marking an item bought now clears its "important" star.** Important is
  meant for "this trip," not forever — checking an item off now drops the
  marker, so it doesn't carry over to your next shopping trip. Unchecking it
  again (undoing a bought mark) doesn't bring the star back. Since a bought
  item can never be important, the "Nylig kjøpt" section no longer shows the
  star badge or swipe-to-mark gesture at all.

## [1.37.0] — 2026-07-19

### Added
- **A quick way to see just your important items.** A small star chip next
  to the item count (only shown once something's marked important) pulls
  those items into their own "Viktig" section above the rest of the list —
  handy for a trip where you're not buying everything on the list. Nothing
  gets hidden: everything else stays right below, in its normal aisle
  order.

## [1.36.4] — 2026-07-19

### Fixed
- **The "how to mark important" modal's demos were hard to read.** The
  swipe/tap illustrations were abstract shapes with no item name or icon,
  making it unclear what was actually being demonstrated. They now show a
  real item (icon + name) — a different common one each time you open the
  modal — so it reads like an actual item on your list.

## [1.36.3] — 2026-07-19

### Fixed
- **Tapping "Oppdater" on the update toast could reload into a blank white
  screen**, recoverable only by fully closing and reopening the app. The
  offline cache was serving the app shell itself stale-while-revalidate,
  so a reload right after a deploy could load old cached HTML pointing at
  JS/CSS files the new deploy no longer serves. The app shell now always
  prefers the network (falling back to the cache only when offline), so
  updates apply cleanly on the first reload.

## [1.36.2] — 2026-07-19

### Fixed
- **The "how to mark important" modal's swipe demo always showed a list
  row, even if you use grid view.** It now mirrors whichever view you
  currently have selected — a small tile for grid, a full-width row for
  list — so the illustration matches what you actually see on the list.

## [1.36.1] — 2026-07-19

### Fixed
- **The changelog's "see full list" action was a leftover plain text link,
  not a real button.** Every other modal in the app uses the design
  system's actual button component for its actions; this one was styled
  by hand with an old, inconsistent treatment. It's now a proper
  low-emphasis button matching the rest of the app.

## [1.36.0] — 2026-07-19

### Added
- **New features now announce themselves.** Updating to a release that adds
  a real new capability now opens a "what's new" modal automatically,
  instead of relying on you noticing and tapping a toast. Smaller fixes/
  tweaks still show the quieter toast, as before. The modal itself now
  spotlights only the last few releases in a larger, easier-to-scan font
  instead of the full history — the complete changelog is still one tap
  away.

## [1.35.0] — 2026-07-19

### Added
- **Swipe right to mark an item important.** Marking a shopping list item
  important used to require a precise tap on the small corner badge on its
  icon. You can now just swipe the item to the right (list or grid view);
  the corner badge still works too. The header's "last synced" text on the
  Handleliste tab is now a small star legend instead — tap it for a short
  how-to with a visual demo of both ways to mark an item important. Sync/
  offline status still shows there when it's relevant.

## [1.34.3] — 2026-07-18

### Fixed
- **Meal and weekly reminders could silently never fire.** Enabling push
  notifications turned both reminder toggles on in the UI, but no
  `notification_settings` row existed until you separately visited Settings
  and changed something — and the reminder cron only sends to lists that
  have one. Subscribing to push now seeds that row with the same defaults
  the UI already showed.
- **Shopping list items could briefly leak between users on a shared
  household device.** The local on-device cache wasn't cleared on logout, so
  the next person to log in could see the previous user's (different list's)
  items until the first background refresh. Logging out now clears the
  cached data.
- **Changing your password allowed a weaker minimum than signing up.**
  `/change-password` only required 6 characters, letting you lower your
  password strength below the 8-character floor enforced at signup and
  password reset. Standardized on 8 everywhere.
- **The "been on the list a while" marker likely never showed on iOS
  Safari.** The date comparison relied on a format Safari doesn't reliably
  parse; it's now normalized before parsing.

## [1.34.2] — 2026-07-18

### Fixed
- **The importance star was on every item, not just important ones.** Every
  item's icon badge showed a star outline, with only a subtle color change
  once flagged — too easy to miss at a glance. Non-important items now show
  no star at all, so a flagged item actually stands out; the same tap area
  is still there to mark an item important in the first place.

## [1.34.1] — 2026-07-18

### Fixed
- **Push notifications showed a plain solid square instead of the app icon.**
  The status-bar badge reused the full-color app icon, but Android strips
  color from that image and fills in only its opaque pixels — since the icon
  had no transparency, the whole square came out solid. Push notifications
  now use a dedicated white-on-transparent silhouette for the badge, so
  Android can mask it correctly.

## [1.34.0] — 2026-07-18

### Added
- **Mark shopping list items as important.** Tap the small star badge on any
  item's icon to flag it — a quick, one-tap action separate from checking the
  item off, so you can flag something as urgent without navigating into the
  edit screen.

## [1.33.2] — 2026-07-18

### Fixed
- **A typo in your current password could log you out entirely.** Changing
  your password or email, or deleting your account, returned the same
  "unauthorized" status the app uses to detect an expired session — so a
  single wrong-password typo bounced you to the login screen with a
  misleading "your session expired" message instead of just showing "wrong
  password." These now return a distinct status the app treats as a normal,
  in-place error.
- **Deleting the last owner of a list could silently fail.** When a list's
  sole owner deleted their account (or a super-admin force-deleted a list),
  the cleanup skipped the "who's viewing the list right now" presence rows,
  which blocked the final list deletion and aborted the whole operation. The
  presence rows are now cleared as part of the cascade.

## [1.33.1] — 2026-07-18

### Fixed
- **The "been on the list a while" marker looked like a new-item notification.**
  A stale shopping list item was flagged with a plain dot in the same top-right
  corner as an unread-notification badge — signalling the opposite of "this
  has been sitting here." It's now a small clock glyph instead, in both list
  and grid view.

## [1.33.0] — 2026-07-18

### Added
- **Every item in the shared catalogue now has an icon.** `itemIcons.js`'s
  name→icon map covered only 500 of the 710 seeded catalogue items, so the
  rest fell back to a plain first-letter badge in grid view. All 210
  remaining items — niche produce, spices, meat/fish varieties, plant milks,
  noodle types, vitamins/first-aid items, cleaning/household sundries, candy
  brands, and the generic category headers (Kjøtt, Fisk, Frukt, Ost, Brød,
  Mel, Olje, Frokostblanding, Pålegg) — now resolve to an icon, most reusing
  an existing drawing and seven backed by new hand-drawn art (artichoke,
  pregnancy test, gloves, broom, scissors, plus a cold-pack/heat-pack pouch
  pair).

## [1.32.5] — 2026-07-18

### Fixed
- **Shopping list rows were a different height depending on whether an item
  had a quantity or a note.** The qty/notes line under an item's name was
  only rendered when there was something to show, so rows without either
  collapsed to a single line while rows with them stretched to two —
  visibly uneven row heights in both list and grid view. That line now
  always reserves its space, whether or not it has content.

## [1.32.4] — 2026-07-18

### Fixed
- **Meal-week swipe snapped back to the wrong week the instant a new drag
  started.** The row's horizontal position was driven by two independent
  pieces of code at once — a `useEffect` that animated it to the current
  week whenever `weekOffset`/the measured pane width changed, and hand-rolled
  pan handlers that also wrote to the same position directly during a touch
  drag — and the two could race, most visibly right as a new swipe began on
  a week other than the current one. The drag is now driven entirely by
  Framer Motion's own `drag` gesture instead of a hand-rolled one, so there's
  a single owner of the row's position at any given moment.

## [1.32.3] — 2026-07-18

### Fixed
- **The "days before an item goes stale" setting couldn't be retyped.** The
  field validated on every keystroke and rejected any intermediate state
  (an empty box, a lone leading digit), so a controlled re-render snapped
  the displayed number straight back — clearing it to type a new value
  never worked, only select-all-and-overtype did. Typing now always shows
  what you type, with an out-of-range or non-numeric value only resolved
  (clamped, or reverted to the last valid number) once you leave the
  field. Added +/- buttons alongside it for one-day nudges.

## [1.32.2] — 2026-07-17

### Fixed
- **Meal-week swipe only revealed the next week after releasing, not during
  the drag.** The previous fix gave the swipe a real slide, but the
  neighbouring week didn't exist in the page until the gesture committed, so
  dragging just moved the current week aside and revealed blank background
  underneath — the new week only appeared once you let go. All navigable
  weeks are now laid out side by side in one row, with the current and
  immediate neighbouring weeks' real data kept fetched, so dragging reveals
  the adjacent week's actual cards sliding into place as you go, the same way
  it moves out — not just after release.

## [1.32.1] — 2026-07-17

### Fixed
- **Meal-week swipe didn't actually slide, and could open the wrong day.**
  The drag gesture was constrained back to its starting position, so a swipe
  only ever rubber-banded a few pixels before the new week's cards popped in
  abruptly instead of sliding over. Because the card barely moved, releasing
  the drag also frequently left the pointer on top of a day card, which fired
  its tap handler and opened that day's edit modal — bound to the day from
  *before* the swipe, so saving it could silently write to the wrong date,
  and the full-screen modal covered the tab bar underneath, reading as it
  "disappearing." Swiping now plays a real calendar-style slide (the current
  week moves fully off-screen as the target week slides in from the correct
  edge, showing a brief skeleton if its data hasn't arrived yet), and the
  drag gesture no longer lets a release-on-card fire that card's tap.

## [1.32.0] — 2026-07-17

### Added
- **Swipe between weeks in Måltider.** The day-card stack can now be dragged
  left/right, as an alternative to the ‹ Forrige/Neste › buttons, to move
  between weeks.

### Fixed
- **FAB briefly mispositioned when switching tabs.** Handleliste's and
  Måltider's floating action button (and its menu scrim) could flash into
  the wrong place for the duration of the tab-switch slide animation. The
  animation moved the whole tab pane with a CSS `transform`, which — per the
  CSS spec — makes `position: fixed` descendants (the FAB) position
  themselves relative to that pane instead of the viewport for as long as
  the transform is applied. Switched the slide to animate `left` instead,
  which doesn't have that effect.

## [1.31.1] — 2026-07-17

### Fixed
- **Meals briefly showing as unplanned when switching weeks.** Navigating
  Måltider to a different week updated the visible date range before that
  week's plan had finished loading, so for an instant every day flashed as
  unplanned against the still-loading data. The date range and plan data now
  update together once the fetch resolves.

## [1.31.0] — 2026-07-17

### Added
- **Instant loading for Handleliste and Måltider.** Both tabs now hydrate
  from the last-fetched data cached in `localStorage` the moment the app
  opens, instead of always starting blank and waiting on the network — a
  returning user sees their real list/week plan immediately, silently
  refreshed in the background. A genuine first-ever load (nothing cached
  yet) now shows a shimmering skeleton shaped like the real rows/day-cards
  in place of the old generic spinner, so first paint doesn't jump. Måltider
  also starts loading its data as soon as the app opens rather than only
  once you switch to that tab, fixing the days briefly rendering as
  "unplanned" before the fetch had a chance to resolve.

## [1.30.1] — 2026-07-17

### Changed
- **Clearer empty-day cards in Måltider.** An unplanned day used to look like
  every other day's card, just with muted italic text ("Ingen måltid
  planlagt") inside the same solid fill. It's now a dashed, unfilled outline
  — a card with nothing in it shouldn't be styled like one with something in
  it — with an active "Legg til måltid" prompt in the accent colour and a
  small plus icon, instead of a passive statement in a colour that read as
  disabled.

## [1.30.0] — 2026-07-17

### Added
- **Shared-axis slide when switching tabs.** Handleliste/Måltider/Innstillinger
  used to swap with an instant `display` cut; the tab you switch to now
  slides and fades in from the direction you came from, riding the same
  spring the tab bar's own sliding indicator already used. Only the incoming
  pane animates (panes have independent heights and the page itself
  scrolls, so animating an outgoing pane out too would risk a layout jump
  for little payoff) — panes stay mounted exactly as before, so switching
  tabs still doesn't re-fetch. "Dempet"/"Klassisk" design intensity and
  `prefers-reduced-motion` collapse it the same way they already collapse
  everything else driven by these motion tokens, with no extra branching.
- **Whole-card tap target for meal day cards.** Each day in Måltider used to
  require hitting a small "Endre"/"Legg til" button in the corner; the
  entire card is now the tap target, with a colour wash + ripple while held
  so it's clear the card itself — not just the corner — is interactive. The
  old button is now a quiet trailing label next to a chevron.

## [1.29.0] — 2026-07-17

### Added
- **Stale-item marker on the shopping list.** Unbought items that have sat
  on the list longer than a configurable number of days (default 7) now get
  a small discreet dot on their icon, computed purely client-side from the
  item's existing `added_at` timestamp — no new notification, push, or cron
  involved. The threshold is a shared household setting, editable from
  Settings → Varsler ("Gamle varer på handlelisten").

## [1.28.1] — 2026-07-17

### Fixed
- **Fixed a crash (blank white screen) when opening the meal-plan modal
  ("Legg til"/"Endre" on any day in Måltider).** The modal briefly renders
  only a loading spinner while its data loads, and the app's focus-trap
  library throws if a dialog has no focusable element at all — which then
  unmounted the whole app since there's no error boundary. `Sheet.jsx` (the
  shared bottom-sheet primitive behind every modal) now gives focus-trap a
  `fallbackFocus` target (the dialog container itself), so a loading modal
  with no other tabbable content no longer crashes.

## [1.28.0] — 2026-07-17

### Added
- **Chip/token editor for meal ingredients and labels** (`docs/ui-review-plan.md` U21). The
  meal-plan and meal-edit modals' ingredients field, and the meal-edit
  modal's labels field, are no longer plain comma-separated text inputs —
  each entry is now a removable chip, added by typing + Enter (or comma) or
  picked from a dropdown. Ingredient suggestions are backed by the shopping
  list's item catalogue, so ingredients map cleanly onto catalogue names for
  the "add to shopping list" flow; label suggestions are backed by every
  label already used across the meal catalogue.
- **"Plan again" one-tap re-plan from the meal catalogue** (U26). Each row in
  "Alle måltider" now has a calendar icon next to it — tapping it assigns
  that meal to the next unplanned day in the week you're currently viewing
  (defaulting the responsible person to that day's recurring default) and
  confirms with an undoable toast, instead of requiring you to open a day,
  search the meal-name dropdown, and save.

### Changed
- **Strengthened the recurring-schedule ("Fast ansvarlig") hint and added a
  save confirmation** (U18). The "Fast: {name}" tag shown on unplanned days
  in the Måltider week view now uses a more visible primary tone with a
  repeat icon instead of a plain neutral tag. Saving a day's recurring
  responsible person in Settings → Vårt hjem now confirms with a "Lagret."
  toast instead of only surfacing feedback on error.

## [1.27.3] — 2026-07-16

### Changed
- **Removed the accordion/collapse pattern from Settings entirely.** Vårt
  hjem's member list, add-member form, and weekly-responsibility list, and
  Administrasjon's icon-gap list, create-owner form, and all-users list are
  now always directly visible (`SubpageSection`, the same block Konto and
  Varsler already used) instead of hidden behind a tap-to-expand
  `AccordionRow`. Every subpage now shows its content immediately — a
  subpage already has the room, so nothing needs a second tap to reveal.
  `AccordionRow`/`AccordionGroup` are removed, having no remaining callers.

## [1.27.2] — 2026-07-16

### Changed
- **Renamed the shopping list FAB's "get the other person's attention" ping
  action from "Gi beskjed" to "Varsle husstanden"** — the old label didn't
  say what was being said or to whom; the new one makes clear the button
  notifies the rest of the household (reusing "varsle," the same verb
  Settings' "Varsler" section is named after), no behavior change.

## [1.27.1] — 2026-07-16

### Fixed
- **Made the Settings subpages consistent with each other.** Konto and
  Varsler — the two subpages showing direct fields rather than accordions —
  now share one `SubpageSection` block (divider + heading, the same chrome
  `AccordionRow` already uses) instead of Konto's ad-hoc bold-label-and-
  divider styling versus Varsler's unlabeled, undivided switches. Also fixed
  Administrasjon's "Statistikk" row, which sat visibly indented relative to
  the `AccordionRow`s above it (a leftover `SettingsRow` icon-chip layout
  meant for the Settings root, not a subpage).

## [1.27.0] — 2026-07-16

### Added
- **Push notifications, phase 2 (TODO #7): a weekly meal-plan reminder and
  an on-demand "get the other person's attention" ping.** Settings →
  "Varsler" gained a second reminder toggle+time for a Sunday-evening nudge
  that only fires if the upcoming week has *no* meals planned at all (not
  "few" — an unambiguous "planning hasn't started" signal, avoiding a nag
  threshold). The shopping list's FAB menu gained a "Gi beskjed" action
  (`POST /push/ping`) that pushes every other subscribed device on the list
  a fixed "trenger oppmerksomheten din" notification, rate-limited to once
  per 2 minutes per list (`notification_state`, new table) so repeated taps
  can't spam the household. Both reuse phase 1's subscribe/settings
  infrastructure; the cron dispatcher was split into independently testable
  per-type checks (`checkMealReminders`/`checkWeeklyReminders`) behind a
  shared `sendPushToList` fan-out helper.

## [1.26.0] — 2026-07-16

### Changed
- **Settings redesigned as a two-tier grouped list with subpages, instead of
  six always-open accordion islands on one long scroll.** The root screen
  now shows two compact grouped clusters — device-local prefs
  (Designintensitet, Tema, Vibrasjon) and navigable rows (Konto, Varsler,
  Vårt hjem, Administrasjon) — each opening its own subpage with a back
  button, both in-app and via the hardware/browser back button. Konto's
  fields are no longer hidden behind accordions now that a subpage has room,
  and its Logg ut/Slett konto actions are pulled into a visually distinct
  danger zone. Statistikk (superadmin) is promoted from a fold-out nested
  three levels deep inside Administrasjon into its own full subpage.

## [1.25.0] — 2026-07-16

### Added
- **See who else has the shopping list open right now.** Above the item
  list, small overlapping avatars show any other household member who's
  actively viewing the list — no manual "I'm done editing" toggle to
  remember, since it's driven by the same background poll the list already
  uses and a person just drops off the row a few seconds after they leave
  the tab or go idle (`POST /presence`, new `list_presence` table).

## [1.24.0] — 2026-07-16

### Added
- **Push notifications, phase 1 (TODO #7): a "no meal planned for tomorrow"
  reminder.** Settings → "Varsler" now has an "Aktiver varsler" toggle that
  requests browser notification permission and subscribes this device to
  Web Push, plus a shared household setting (any list member can change it)
  for a daily reminder time — a cron check every 15 minutes sends a push to
  every subscribed device on a list if tomorrow still has no meal planned by
  that time, deduped so it never sends twice for the same day. Built on
  `@pushforge/builder`, a small dependency-free (Web Crypto only) Web Push
  library — a deliberate, documented exception to this app's usual
  no-external-crypto-deps stance, since hand-rolling RFC 8291's payload
  encryption by hand carries more security risk than a focused, audited
  library. Web Push on iOS only works for the PWA installed to the Home
  Screen (iOS 16.4+), not an ordinary Safari tab — Settings shows a hint
  when that's the case. Batched item-added notifications, a weekly
  meal-plan reminder, and a custom "get the other person's attention" ping
  remain future phases of the same TODO item.

## [1.23.8] — 2026-07-16

### Fixed
- **Sheets and the FAB menu now use a real focus-trap library instead of
  hand-rolled Tab-cycling.** Every modal (via `Sheet`) and the shopping/meal
  FAB speed-dial menu now trap keyboard focus with `focus-trap-react`
  (replacing two separate hand-written implementations), and background page
  scroll is now locked while a sheet is open — previously the page behind an
  open sheet could still be scrolled.
- **Checked-off shopping items now re-sort into "Nylig kjøpt" in sync with
  the real animation, not a hand-tuned timer.** Previously a fixed 400ms
  `setTimeout` (manually tuned to approximate the strike-through+fade) drove
  when an item left the unbought list; it now waits for Framer Motion's own
  `onAnimationComplete` when the pop animation is actually playing, falling
  back to the fixed timer only when animations are off (reduced motion /
  "classic" intensity), where there's no animation to key off in the first
  place.
- **Tightened-up spacing and copy in the "Sannsynligvis tom for" FAB modal.**
  The stats line sat only 2px below the item name — below the design
  system's 4px base spacing unit — while the equivalent secondary-line
  pattern elsewhere (`.meta`, `.setrow .v`) uses 4px; `.meal-browse-row
  .stats` now uses `var(--space-1)` to match. Also simplified the stats
  copy from "Sist kjøpt for 12 dager siden · vanligvis hver 7. dag" to
  "12 dager siden · Ca hver 7. dag".

## [1.23.7] — 2026-07-16

### Fixed
- **"Sannsynligvis tom for" FAB modal now follows the design system.** Its
  "Legg til annen vare" action was a raw `<button>` with hand-rolled inline
  styles overriding the shared `.meal-browse-add` class, instead of the
  `Button` component every other modal footer uses — it now sits in a
  standard `.actions` row as an `outline`-variant `Button`, matching
  siblings like `WeekIngredientsModal`.

## [1.23.6] — 2026-07-16

### Fixed
- **Superadmin accounts can no longer be deleted at all, by anyone.**
  `DELETE /account` (self-delete) and the superadmin-only
  `DELETE /admin/users/{u}` (force-delete) both now refuse outright — no
  override flag, unlike the existing last-owner cascade guard — the moment
  the target matches `SUPERADMIN_USERNAMES`, whether it's a superadmin
  self-deleting or one deleting another. Superadmin status comes solely
  from that env var, which this code has no way to edit, so the only path
  back after a deletion would be a developer editing the Worker's
  dashboard variable by hand.

## [1.23.5] — 2026-07-16

### Added
- **A real favicon.** The site previously had no `<link rel="icon">` at all
  (just an `apple-touch-icon`), so browser tabs and bookmarks fell back to
  a generic globe/blank icon. Added `favicon.svg` (crisp at any size,
  modern browsers), a 32×32 PNG fallback, and a hand-built multi-resolution
  `favicon.ico` (for user agents that ignore `<link>` tags and request
  `/favicon.ico` directly) — all rasterized from the same
  `panhandle-icon.svg` mark the app icons already use, so the tab icon now
  matches the home-screen/PWA icon. Wired into `app.html`, `public/index.html`,
  and `public/changelog.html`.

## [1.23.4] — 2026-07-16

### Changed
- **Trimmed `CLAUDE.md` by about half** to cut token spend on every new
  Claude Code session. Detailed reference material that isn't needed
  turn-to-turn — the per-migration history, the `app.html`-naming
  rationale, and a few auth/changelog implementation asides — moved to
  a new `docs/architecture-notes.md`, read on demand instead of always
  preloaded. No functional change.

## [1.23.3] — 2026-07-16

### Fixed
- **The icon/letter circle on list-view item cards was clipped by the
  card's top-left corner.** `ItemCard.jsx` passed `padding: undefined` in
  the inline `style` object it hands to `Card`; since that object is
  spread onto the style after `Card`'s own default padding is computed,
  the explicit `undefined` still overwrote the `sm` padding, leaving list
  rows with no padding at all. With no clearance, the badge sat flush
  against the card's rounded (asymmetric, 28px top-left) corner and got
  cut off by it. Padding is now only overridden for grid tiles, letting
  list rows fall back to `Card`'s own `sm` padding.

## [1.23.2] — 2026-07-16

### Fixed
- **Member list in Settings showed a stray "0 0" next to non-admin,
  non-owner members** (e.g. "Saffa 0 0"). The Eier/Admin badges were
  gated with `u.is_owner && <Badge>`/`u.is_admin && <Badge>` — since the
  API returns these as `0`/`1` integers rather than booleans, `0 && x`
  evaluates to `0`, and React renders that literal `0` instead of
  nothing. Coerced both to booleans (`!!u.is_owner`/`!!u.is_admin`) so a
  member with neither flag shows just their name.

## [1.23.1] — 2026-07-16

### Added
- **A full changelog page at `/changelog.html`**, linked from the landing
  page footer and from the in-app "Hva er nytt" modal's "Se hele
  endringsloggen" link (previously an off-domain link to the file on
  GitHub). It's a static, unauthenticated page — no build step, matching
  `public/index.html`'s pattern — that fetches `/CHANGELOG.md` and renders
  the full version history client-side with a small hand-rolled markdown
  renderer, rather than sending anyone who wants full release detail off
  to GitHub.

### Changed
- **Landing page copy no longer assumes exactly two people.** Panhandle
  supports a household of one to ten people (see the 10-user cap on
  `POST /list-users`), but `public/index.html`'s hero and feature copy was
  still written as "for dere to" ("for the two of you") / "begge" ("both of
  you") from before multi-tenant support shipped. Reworded to "for
  husstanden" ("for the household") / "alle" ("everyone") instead;
  `README.md` and `CLAUDE.md`'s opening descriptions updated to match.

## [1.23.0] — 2026-07-16

### Added
- **Every account now has a Name, e-mail, and username, editable in
  Settings — and the username always mirrors the e-mail.** Settings → "Meg
  & min app" gained a "Navn" field (`POST /change-name`), shown as
  "Innlogget som" throughout the app (shopping-list "lagt til av", meal
  responsible avatars/dropdowns, member lists) instead of the raw
  username/e-mail. Signing in with Google now seeds Name/e-mail from your
  Google profile the first time (never overwriting a later local edit).
  Changing your e-mail (`POST /change-email`) now renames your username to
  match everywhere it's stored (shopping items, meal-plan responsibility,
  recurring schedule) and signs you into a fresh session automatically.
  Adding a household member or a new owner (Settings → "Legg til
  medlem"/"Opprett eier") now asks for their name and e-mail instead of a
  freeform username. Existing accounts whose username didn't already match
  their e-mail were migrated directly in production.

## [1.22.7] — 2026-07-16

### Changed
- **The in-app changelog ("Hva er nytt") now shows entry titles only, not the
  full text of every release.** `ChangelogModal.jsx` previously fetched raw
  `CHANGELOG.md` and dumped it verbatim into a scrollable `<pre>` block. It
  now parses out just each version's lead sentence per entry
  (`src/lib/changelogUtils.js`) and links out to the full changelog on GitHub
  for anyone who wants the complete description.

### Docs
- **`TODO.md`'s completed-items log moved to a new `Todo_done.md`**, numbered
  sequentially (oldest to newest) instead of being an unnumbered flat list;
  `TODO.md`'s open items are now grouped into themed sections (Feature, Data
  model, Performance, UI/Polish) with an explicit priority ranking instead of
  one flat value-sorted list.
- **Repo cleanup pass**: fixed stale claims in `README.md` (offline
  mode/service worker were listed as missing/future despite `public/sw.js`
  already shipping real offline app-shell caching), added "Historical"
  banners to three docs (`docs/multi-tenant-plan.md`,
  `docs/multi-tenant-migration-log.md`, `docs/seed-catalogue-deploy.md`)
  describing already-shipped one-time work, corrected a stale migration
  filename reference, documented `scripts/compute-icon-offsets.mjs` in
  `CLAUDE.md`, and removed one dead CSS rule (`src/index.css`'s `#allUsers`
  selector, which targeted a nonexistent element).

## [1.22.6] — 2026-07-16

### Changed
- **The "Installer Panhandle" install CTA in Settings no longer stays at full
  size forever.** It previously showed the same large, high-contrast hero
  block on every visit until the browser's `appinstalled` event fired in
  that exact page load — so a user who'd already installed but opened the
  site in an ordinary browser tab (not the installed app) kept seeing the
  full prompt every time, and the "installed" signal itself was never
  persisted across reloads. Now: the full CTA (unchanged) is still the
  default for anyone who hasn't installed or interacted with it — its job is
  to actually drive installs, so it stays maximally prominent there. Once
  installed (now persisted in `localStorage`, surviving reloads) it demotes
  to a compact filled pill rather than disappearing outright, since that
  signal can go stale after an uninstall and a demoted-but-visible CTA is a
  safer failure mode than a vanished one. A new dismiss ("×") button on the
  full CTA demotes it further, to a plain text row, since an explicit
  "not now" is a stronger signal than an inferred one.

## [1.22.5] — 2026-07-15

### Security
- **Removed the `/seed` account-bootstrap endpoint.** It was a one-time,
  secret-gated (`SEED_SECRET`) route for creating the very first account(s)
  of a fresh deployment, meant to be disabled after first use — but since
  self-service signup (`POST /register`) and "Sign in with Google" now cover
  account creation, and admins/owners can create accounts via `POST
  /admin/owners`/`POST /list-users`, it was no longer needed and was still a
  standing (if secret-gated) attack surface. Deleted the route, `SEED_SECRET`
  handling, the `public/seed.html` form, and all references to it in
  `wrangler.toml`, `README.md`, `CLAUDE.md`, and the service worker. The
  `SEED_SECRET` variable should also be removed from the Worker's Cloudflare
  dashboard (Settings → Variables and Secrets), since nothing reads it
  anymore. Integration tests bootstrap throwaway accounts by writing
  directly to the local D1 SQLite file instead of calling an HTTP endpoint.

## [1.22.4] — 2026-07-15

### Fixed
- **The meal planner's "Endre"/"Legg til" button on today's card was hard to
  read, in both light and dark mode.** Today's card flips to an inverse
  surface, but the button's `outline` style used the ambient theme's
  color/border tokens instead of the inverse ones, leaving low-contrast text
  against the flipped background either way. It now uses the matching
  inverse tokens on today's card.
- **Switching the shopping list between grid and list view changed what was
  in "Nylig kjøpt" (recently bought), not just how it looked.** The section
  capped at a different number of items per view (9 in grid, 3 in list) to
  fill out each layout's rows, so toggling the view made items appear or
  disappear. It now shows the same fixed set of items in both views.
- Meal planner week view: non-today day cards are more compact (smaller
  padding, tighter spacing) so the week takes up less vertical space overall.

## [1.22.3] — 2026-07-15

### Docs
- **`CLAUDE.md`, `README.md`, and `docs/` had drifted from the actual
  codebase.** `CLAUDE.md` was missing six migrations (recurring meal
  schedules, meal/item suggestion stats, and self-service signup/Google
  sign-in/password recovery), the newer Worker secrets and endpoints those
  features need, and had a stale note about the catalogue item count that
  was already fixed. `README.md` still described the pre-rewrite vanilla-JS
  app instead of the Vite + React build. `docs/multi-tenant-setup.md` — a
  one-time cutover runbook — was linked from both as if it were current
  setup documentation; it's now marked historical in place. No code changes.

## [1.22.2] — 2026-07-15

### Fixed
- **The app had no visible edge on a desktop-width window.** The layout was
  already centered in a 480px column on wide screens, but shared the exact
  same background as the surrounding page, so it was hard to tell where the
  app ended. On viewports wider than 700px, the page now gets a contrasting
  backdrop and the app sits in a bordered, shadowed frame.

## [1.22.1] — 2026-07-15

### Fixed
- **"Sign in with Google" could go missing from the login screen after a
  session timeout.** When a JWT expires, the app drops back to the login
  screen in place, without a full page reload — but Google's sign-in script
  keeps internal state tied to the page's original load, which can go stale
  after the page has stayed open a long time (exactly how a session timeout
  happens) and silently fail to draw the button. The login screen now
  re-fetches a fresh copy of Google's script every time it's shown instead of
  reusing a possibly long-loaded one, matching what a real page reload would
  do.

## [1.22.0] — 2026-07-15

### Added
- **Superadmin can now delete a list's last owner (and the whole list with it).**
  Deleting any other user under Administrasjon still just deletes that
  account, but deleting a list's sole owner used to be flatly refused
  ("Listen ville miste sin eneste eier"). It now shows an explicit warning
  that this permanently deletes the entire list (varer, katalog, måltider)
  for everyone on it, and only proceeds on confirmation.

### Fixed
- **New lists were seeded with a much smaller item catalogue than existing
  ones.** `migrations/0002_seed_catalogue.sql` and `0003_expand_catalogue.sql`
  backfilled ~710 common Norwegian household items into every list that
  existed at the time they were run, but new lists created since (via
  registration, admin-created owners, or Google sign-in) only ever got the
  original, much smaller ~120-item seed list baked into the Worker — a real
  household already hit this in production. Every new list now gets the
  same full ~710-item catalogue as older ones; existing under-seeded lists
  were backfilled directly.

## [1.21.9] — 2026-07-15

### Fixed
- **Checking off an item could leave it stuck in the list.** Marking an item
  bought sometimes left a faded, unclickable ghost row in place instead of
  reflowing the rest of the list — most reliably if you switched to another
  tab and back while the "checked off" animation was still playing. Caused
  by an animation-library edge case where an item's exit tracking got
  permanently stuck if its pane was hidden mid-animation; the shopping list
  now cleanly resets its item animations whenever you return to the tab, and
  the item card no longer mixes two competing animation engines for its
  "checked off" effect. Also stopped an unnecessary extra list refetch on
  every toggle that could let two rapid taps' results arrive out of order.

## [1.21.8] — 2026-07-15

### Fixed
- **Trailing quantities in new item names weren't parsed.** Typing "2 melk"
  correctly split into item "Melk" with qty 2, but "Melk 2" was added as a
  literal new catalogue item called "Melk 2" instead of "Melk" with qty 2.
  A leading or trailing number below 20 is now parsed as the quantity
  either way; larger numbers (e.g. "Yoghurt 500") are still left alone since
  they're usually part of the product size/name.

## [1.21.7] — 2026-07-15

### Changed
- **Grid ⇄ list now animates.** Switching the shopping list's view toggle
  used to snap instantly (the grid and list cards were separate components,
  so React swapped them outright). Cards now morph smoothly between the row
  and tile shape, ripple in with a slight stagger under Ekspressiv intensity,
  and the icon/text ease into their new spot instead of popping. The
  Liste/Rutenett toggle buttons also gained a sliding indicator. Classic
  intensity is unaffected — it still forces list view with no motion.

## [1.21.6] — 2026-07-15

### Changed
- **Settings tab decluttered.** Every subsection (E-post, Bytt passord,
  Slett konto, medlemslister, m.fl.) now starts minimized, and opening one
  automatically closes any other that was open in the same section instead
  of letting them stack up. The three main sections (Meg & min app, Vårt
  hjem, Administrasjon) now each carry a clearly separated title strip, and
  the "Installer Panhandle" prompt moved to the top of the screen.

## [1.21.5] — 2026-07-15

### Fixed
- **Shopping list grid-view icon badges looked misaligned.** Badges now
  anchor to a fixed offset from the top of each card instead of centering
  with the text below, so they line up across a row regardless of whether
  an item has a qty/notes subtitle. The single-letter fallback badge (shown
  when an item has no matching icon) and the hand-drawn SVG icons
  themselves are now optically centered in their circle too — the icons
  were drawn asymmetrically within their canvas, so each one's true visual
  center is now computed and corrected individually.

## [1.21.4] — 2026-07-14

### Changed
- **Feedback emails now identify the sender more reliably.** The username
  was already in the subject/body, but the Worker now also looks up the
  sender's account email (if they have one on file) and sets it as the
  email's reply-to address, so replying from the recipient's inbox goes
  straight to that person instead of the shared `noreply@` sending address.

## [1.21.3] — 2026-07-14

### Added
- **Send feedback from the app** (Settings → "Send tilbakemelding", next to
  "Hva er nytt?"). A small modal with a free-text message emails
  `env.FEEDBACK_EMAIL` via the same Resend integration already used for
  password recovery — no ticketing system needed for a 2-person app. New
  authenticated `POST /feedback`, rate-limited 5/hour/IP (same
  `rate_limit_attempts` pattern as `/register`/`/forgot-password`).
  `FEEDBACK_EMAIL` is a new Worker dashboard variable requiring the same
  manual one-time setup as `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY`.

## [1.21.2] — 2026-07-14

### Fixed
- **Landing page's shopping-list mockups were stale.** They showed a
  per-category header row (e.g. "Kjøtt og fisk", "Meieriprodukter") above
  groups of items — a UI pattern the real app no longer has; unbought items
  have rendered as one flat, aisle-sorted list/grid with no category
  dividers since the shopping list's category-section removal. Removed the
  fake headers from both the list-view and grid-view mockups in
  `public/index.html`; "Nylig kjøpt" (recently bought) keeps its own label,
  since that section is still real.

## [1.21.1] — 2026-07-14

### Added
- **Let the super-admin delete a user account outright** (Settings →
  Administrasjon → "Alle brukere" → "Slett", superadmin-only). New
  `DELETE /admin/users/{u}`, gated beyond ordinary `is_admin` by
  `isSuperAdmin` (same double-gate as `GET /admin/metrics`) since deleting a
  row outright is more consequential than the existing admin endpoints,
  which only ever demote/reset/remove-from-one-list. Refuses (doesn't
  cascade) if the target is the last admin site-wide or the last owner of
  their list, mirroring `PATCH /admin/users/{u}/flags`'s existing guards —
  the superadmin promotes/reassigns someone else first, same as any admin
  already has to when demoting the last admin/owner.

## [1.21.0] — 2026-07-14

### Added
- **Let a user delete their own account** (Settings → Profile → "Slett
  konto"), requiring current-password confirmation plus an explicit confirm
  dialog. A non-owner (or an owner with a co-owner) just leaves the list; the
  list's last/sole owner cascade-deletes the entire list — shopping list,
  meal plan, catalogue, recurring schedule, and every other member's account
  — since there's no "reassign ownership" flow yet and blocking self-deletion
  outright would leave solo/last-owner accounts with no way to close their
  account at all. New `DELETE /account` endpoint, same current-password +
  IP-throttle pattern as `/change-password`/`/change-email`. This is phase 1
  of the account-lifecycle TODO item — still one list per user; "exist
  without a list" / multi-list membership is a separate future phase.

## [1.20.3] — 2026-07-14

### Changed
- **The recurring meal responsibility section in Settings can now be
  minimized.** It's wrapped in the same `AccordionRow` used by
  `MembersIsland`'s/`AdminIsland`'s/`ProfileIsland`'s sub-sections
  (defaulting to open, so nothing changes at first glance) instead of
  always being fully expanded.

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
