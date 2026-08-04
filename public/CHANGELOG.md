# Changelog

## [1.60.1] — 2026-08-04

### Fixed
- **The app could stop responding to touch for a while after closing a dialog and immediately switching away.** Tapping Cancel/Save and right away backgrounding the app (switching apps, locking the phone) could leave an invisible full-screen layer behind, silently swallowing every tap once you came back — sometimes for much longer than usual, since a backgrounded tab's animations and timers run slower. The screen now stops blocking touch the instant a dialog's close is requested, instead of waiting for its exit animation (or the fallback timer backing it up) to actually finish. (`Sheet.jsx`'s backdrop now sets `pointer-events: none` as soon as it's told to close, rather than only once `onExited` actually unmounts it — a more general safety net for the same class of bug fixed differently in 1.58.2.)
- **Pressing back once while a confirmation dialog was open on top of another dialog closed both instead of just the confirmation.** For example, confirming a delete from the item editor, then hitting back, used to close the confirmation *and* the item editor together. Only the top-most dialog closes now. (`Modal.jsx` tracks open dialogs as a stack instead of a count, so only the current top of the stack reacts to a given back-press, restoring the guard for whatever's left underneath.)

## [1.58.3] — 2026-08-04

### Fixed
- **"Recently bought" no longer briefly grows past its usual size when you check off an item.** Checking off a 10th item used to hold the list at 10 rows for a moment before the oldest one disappeared, rather than smoothly settling back to 9. The oldest row now fades out at the same time the new one arrives, instead of lingering after it. (`ShoppingListTab.jsx`'s `BOUGHT_CAP` slice now hands a card that falls out of the cap a synced `evicting` fade — new `evictingIds` state, mirroring the existing `resolvingIds` hold-then-resolve pattern used when an item first gets checked off — instead of relying on Framer's default `AnimatePresence` exit, whose lingering-in-place duration was what let the section balloon by one row. `ItemCard.jsx` gained a matching `evicting` prop/`onEvicted` callback.)

## [1.58.2] — 2026-08-03

### Fixed
- **Editing items while marking others as bought could freeze the shopping list.** Holding one item to edit it, saving, then quickly holding a different item to edit that one too could leave the whole list unresponsive — taps and scrolling stopped working, and holding an item just selected its text instead of opening the editor. (The item editor's modal was rendered without a React `key`, so switching straight from one item's editor to another's, before the first one's ~500ms close animation finished, reused that still-closing modal instance instead of opening a fresh one for the new item — leaving its full-screen backdrop stuck in place, silently swallowing every touch. `ShoppingListTab.jsx`'s `<ItemEditModal>` is now keyed on the item id, so a mid-close switch forces a clean remount instead.)

## [1.58.1] — 2026-08-03

### Added
- **Typing a modifier word after an item name now saves it as a note instead of creating a junk new item.** For example, "yoghurt vanilje" now adds "Yogurt" with "vanilje" saved as its note, rather than creating a brand-new "Yoghurt vanilje" item with no category. This only kicks in when the full typed phrase doesn't already match something in the catalogue, so recognized items (including multi-word ones like "chicken fillet") are never split apart. (`matchWithDescriptor` in `src/lib/shoppingUtils.js`, wired into `ShoppingListTab.jsx`'s `addItem`.)

### Fixed
- **Adding "3 stk egg" no longer leaves a redundant "stk" note on the item.** "stk" is just Norwegian for "piece(s)" — information already shown by the quantity itself — so it's dropped instead of appearing as a note; other count units like "boks" or "pose" that describe real packaging are still kept. (New `buildItemNotes` helper in `src/lib/shoppingUtils.js`.)

## [1.58.0] — 2026-08-03

### Added
- **Opening an item now shows who last touched it, and when.** The item detail sheet has a small line at the bottom saying who added it or, if it's since been edited, who made that edit and when — just the most recent of the two, so it's always the freshest answer to "who put this here?" (New `list_items.edited_by`/`edited_at` columns, migration `0026_item_action_metadata.sql`, stamped by `PATCH /list/:id` only for an actual name/category/qty/notes edit — not the important-star toggle. `ItemEditModal.jsx` picks whichever of add/edit is more recent and formats the timestamp in the active UI language.)

## [1.57.8] — 2026-08-03

### Fixed
- **The add-item dropdown now tells you when a suggestion is already on your list.** Picking a name that was already sitting unbought used to silently bump its quantity instead of you knowing that's what would happen. Matching suggestions are now marked "Already on list" so that's a visible choice rather than a surprise. (`ShoppingListTab.jsx`'s suggestion rows now flag any match whose name is also an unbought `list_items` row; new `shoppingList.addInput.alreadyOnList` dictionary entry in both languages.)

## [1.57.7] — 2026-08-03

### Fixed
- **"What's new" no longer announces an update you haven't actually gotten yet.** Right after a new version was deployed, opening the changelog could show that newer version's notes even though your device was still running the previous one until you reloaded — confusing, since Settings still correctly showed the old version number. The changelog now only ever shows entries up to the version actually running in your tab. (`ChangelogModal.jsx` filters `parseChangelog`'s entries against the bundled `APP_VERSION` via a new `compareVersions` helper in `src/lib/version.js`, since `/CHANGELOG.md` is fetched fresh over the network and can reflect a deploy this tab's JS hasn't picked up yet.)

## [1.57.6] — 2026-08-03

### Fixed
- **Grid view now works in Classic appearance mode too.** It used to silently fall back to the list layout whenever Classic was selected, even if you'd chosen grid view. Switching between grid and list under Classic now works like the other appearance modes, just without the reflow animation — consistent with Classic's calmer, motion-free style everywhere else in the app. (`ShoppingListTab.jsx`'s `effectiveViewMode` no longer forces `"list"` for `intensity === "classic"`; it now always mirrors the user's stored `ph_view` preference, and the desktop multi-column widening — previously classic-only exempt — now applies in every intensity. The view toggle button is no longer disabled/dimmed under Classic, and the now-unused "grid view is off" tooltip string was removed.)

## [1.57.5] — 2026-08-02

### Fixed
- **Every modal in the app (the item editor, meal planner, confirmation dialogs, and more) now visibly animates back down when you dismiss it, instead of vanishing instantly.** Only the opening animation was ever wired up — tapping Cancel, Save, Confirm, or outside the dialog all made it disappear in a single frame. Every dismissal route (Cancel/Confirm/Save buttons, tapping the background, Escape, dragging the sheet down, and the browser's back button) now plays the same spring-out motion the sheet already used to open with, and a drag-dismiss continues the live throw instead of snapping back to a fixed starting point first. (`Sheet.jsx` no longer unmounts synchronously when `open` goes false; it keeps rendering through a new `ph-sheet-out`/`ph-dialog-out`/`ph-scrim-out` CSS exit — or, for a committed drag, an imperative `animate()` continuing the current `y` offset/velocity — and only calls a new `onExited` callback once that's actually finished. `Modal.jsx` now owns a `requestClose(finalCallback)`, handed to modal content as a render-prop (`children(requestClose)`), so a Cancel/Confirm/Save action requests the animated close instead of calling its own `onClose`/`onSaved`-style prop directly and cutting the animation short mid-flight; every modal-content component — `ItemEditModal`, `MealEditModal`, `MealPlanModal`, `ConfirmContext`'s confirm dialog, and the rest — was updated to route through it.)

## [1.57.4] — 2026-08-02

### Fixed
- **The drag handle at the top of a modal (the little pill you swipe down to close it) is now much easier to grab on a phone.** It was reported hard to hit reliably on a Samsung phone — the drag itself worked once you actually caught it, but the visible pill was only 4px tall, smaller than the touch target size any touchscreen UI convention recommends. The pill still looks the same; the tappable/draggable area around it is now much bigger. (`Sheet.jsx`'s grabber wraps the 40×4px visible pill in a separate 44px-tall hit-target `div` that now carries the `onPointerDown`/`touchAction: 'none'` drag-start handlers, matching the platform-standard minimum touch target.)

## [1.57.3] — 2026-08-02

### Fixed
- **A handful of small, low-impact backend/data bugs from an earlier audit are now fixed.** Removing or checking off a shopping-list item that had already vanished (e.g. deleted from another device moments earlier) used to silently report success instead of telling you nothing happened. Assigning meal responsibility to a name that happens to match a real account on someone else's household is now rejected, closing off a rare case where that entry could later get silently rewritten if that other account renamed itself — a made-up name (like "Babysitter") still works exactly as before. On a device set to a timezone west of UTC, the meal planner's pre-filled "who's responsible" suggestion could be off by a day; it now always matches the correct day regardless of timezone. (`worker/index.js`'s `/list/:id/toggle` and `DELETE /list/:id` now return 404 `ITEM_NOT_FOUND` instead of `200 ok` for a nonexistent or other-list id; `/plan` and `/recurring` validate `responsible` via a new `validateResponsible` helper and `RESPONSIBLE_ACCOUNT_MISMATCH` error code; `src/lib/mealUtils.js`'s `dayOfWeekMonFirst` parses a `"YYYY-MM-DD"` string's calendar fields directly into a local `Date` instead of round-tripping through `Date`'s UTC parsing + a local `getDay()` read.)

## [1.57.2] — 2026-07-31

### Fixed
- **Removing an item from your shopping list now asks you to confirm first, and the item editor's two delete options are now sized to match how serious they actually are.** "Remove from list" — the everyday one-tap action, since the item stays remembered for next time — used to delete instantly with zero confirmation and, confusingly, looked like the scarier of the two options. "Forget item and purchase history entirely" — which also erases past "Recently bought" entries — was a barely-visible 12px text link. Removing now shows a lightweight confirm step with a calm button style; forgetting is now a proper (if still deliberately smaller) button, so it reads as the more serious action it is. (`ItemEditModal.jsx`'s `removeFromList` gains the same `useConfirm()` gate `deleteFromCatalogue` already had, via new `itemEdit.confirmRemove.*` i18n keys with `danger: false` so its confirm dialog stays calm too; `removeFromList`'s button switched from `variant="danger"` to `variant="outline"`, and `deleteFromCatalogue`'s plain text link became `Button variant="danger" size="sm"`.)

## [1.57.1] — 2026-07-30

### Fixed
- **Checking off the last item on your shopping list no longer shows the "Nothing left to buy" message popping in underneath the item before it's fully gone, then jumping up into place.** The celebration now waits until the checked-off item has actually finished leaving the screen. (`ShoppingListTab.jsx`'s `celebrate`/`allBoughtSettled` trigger moved from firing as soon as the departing card left React state — which is when its Framer exit animation *starts*, not finishes — to firing off `AnimatePresence`'s `onExitComplete`, via a new `awaitingExitRef`; `markAllBought` was updated the same way.)

## [1.57.0] — 2026-07-30

### Added
- **On a wide screen, Settings → Appearance now has a "Use phone layout" toggle to switch back to the phone-style layout if you prefer it.** Only shows up on desktop-width screens, and only affects this device. (Adds a per-device layout override — `ph_layout_override` in `localStorage`, read by `src/lib/layoutMode.js`'s `currentLayoutMode()` — that takes precedence over the automatic viewport-width detection; the toggle's own visibility is driven by a separate viewport-only check, `useIsDesktopViewport`, so turning the override on can't hide the control needed to turn it back off.)

## [1.56.1] — 2026-07-30

### Fixed
- **Checkmarks are back in checkboxes across the app, and picking which ingredients to add from a meal now makes it obvious which ones you've selected.** Every checkbox — including the shopping list's "got it" toggle — was silently missing its checkmark glyph. Separately, the ingredient picker reused that same "got it" look for its checked state, so a selected ingredient appeared crossed out and greyed like a *finished* item rather than one that would be added — the opposite of what checking it meant. (`Checkbox.jsx`'s icon class was `ph-check-bold`, which isn't a real Phosphor icon — weight variants need their own stylesheet import and a `ph-{weight}` class prefix, not a suffixed icon name; fixed to `ph-check`, the regular weight actually loaded by the app. `Checkbox` also gained a `variant="select"` mode — used by `IngredientChecklist.jsx` — that skips the strikethrough/muted styling and instead tints the whole row via a new `.ing-row--selected` background in `index.css`.)

## [1.56.0] — 2026-07-30

### Added
- **Typing an amount like "50 g smør" now shows up as a single "50 g" amount instead of a confusing "×50" count next to a stray "g" tag.** Panhandle now tells apart a count ("3 stk", "2 boxes") from an amount ("50 g", "1,5 kg", "0.33 l") when parsing a typed quantity. Amounts also now accept decimals (comma or dot) and recognize more units — Norwegian "dl"/"cl"/"pakke"/"boks"/"pose"/"flaske"/"dusin"/"knippe", and imperial oz/lb/cup/tbsp/tsp/pt/qt/gal for households that don't use metric. Applies everywhere a quantity gets parsed: manual shopping-list entry and importing ingredients from a meal or recipe. (`parseItemInput` in `src/lib/shoppingUtils.js` now classifies each recognized unit as Antall — a count, `qty` stays a number — or Mengde — an amount, `qty` pinned to 1 with the number fused to its unit in one string — and accepts a comma/dot decimal on Mengde amounts; `buildIngredientRows`/`IngredientChecklist.jsx` updated to match.)

## [1.55.3] — 2026-07-30

### Changed
- **Adding a new meal now leads with typing its name, with the recipe-link import tucked behind a secondary "Import from a recipe link" button instead of sitting at the top of the screen.** Typing a meal name by hand is the common case, so it's now the first thing you see when adding a meal; tap the smaller import link if you'd rather paste a recipe URL, and the same URL field and Import button appear below. (`MealEditModal.jsx`'s recipe-URL row is now gated behind a `showImport` toggle, reordered below the name field.)

## [1.55.2] — 2026-07-30

### Fixed
- **Ingredients added from the meal planner (or a recipe import) now get their quantities read correctly, the same as typing them into the shopping list by hand.** An ingredient like "2 kg poteter" previously landed on the shopping list as one unmatched item literally named "2 kg poteter" with a quantity of 1, instead of a quantity-2 "Poteter" line under the right category. The picklist shown before adding also now displays each ingredient's quantity/unit. (`buildIngredientRows` in `src/lib/mealUtils.js` now runs each raw ingredient through the same `parseItemInput` qty/unit stripping the manual add field uses before matching it against the catalogue; `addRowsToList` posts that parsed qty/unit instead of a hardcoded `qty: 1`.)

## [1.55.1] — 2026-07-29

### Fixed
- **Modals can now be dismissed by dragging the handle down, and tapping outside a floating-action-button menu now closes it too.** The little pill at the top of a modal looked draggable but wasn't wired up before; it now drags down to close, snapping back if you don't drag far enough. Tapping outside an open FAB menu (the "+" button's action list on the Shopping List and Meals tabs) previously only closed it via Escape — an outside tap did nothing and could accidentally trigger whatever was underneath. (`Sheet.jsx` gained a framer-motion drag gesture on its content container, started only from the pill via `useDragControls`, so the sheet's own scrollable content is unaffected; `FabMenu.jsx`'s focus-trap was missing the same `allowOutsideClick: true` fix `Sheet.jsx` already had for the same underlying bug.)

## [1.55.0] — 2026-07-29

### Added
- **You can now paste a recipe link when adding a meal, and Panhandle fills in its name and ingredients for you.** Paste a URL from a recipe site into the new field at the top of the meal editor and hit Import — the name and ingredient list are read from the page and dropped into the existing fields, ready to review and save just like a hand-typed meal. (New `POST /recipe-import` endpoint reads the page's schema.org `Recipe` JSON-LD via a new pure `parseRecipeFromHtml` helper; ingredients flow onto the shopping list afterward through the existing meal-planning UI, unchanged.)

## [1.54.1] — 2026-07-29

### Fixed
- **Every person on the meal plan now gets their own distinct color.** Two household members' avatars could previously land on the same color by coincidence, making it harder to tell at a glance whose turn it is; colors are now assigned so no two current list members share one (up to the 10-person household cap). Also applies to the "also here" avatars on the shopping list. (`avatarColorForIndex` in `src/lib/avatarColor.js`, keyed by each person's position in `GET /list-users`' member list via a new `colorFor` in `ListUsersContext`.)

## [1.54.0] — 2026-07-29

### Added
- **You can now subscribe to the household meal plan from Google, Apple, or Outlook Calendar.** Generate a personal link in Settings → Calendar sync and add it to your calendar app as a "subscribe by URL" feed — new and changed planned meals show up automatically without needing to open Panhandle (calendar apps typically refresh every few hours, not instantly). Each person chooses whether their feed shows everyone's planned meals or just the days they're responsible for, and that choice can be changed anytime without breaking the link already added to your calendar app. (New public `GET /api/calendar/{token}.ics` feed endpoint backed by a hand-rolled RFC 5545 iCalendar serializer, per-user `ics_token_hash`/`ics_scope` columns on `users`, `migrations/0025_calendar_feed.sql`.)

## [1.53.4] — 2026-07-29

### Fixed
- **Clicking outside a modal (like the suggestions popup) now closes it again on desktop.** It used to only respond to the Escape key — clicking the dimmed background around it did nothing, which was confusing since that's the normal way to dismiss a dialog. This affected every modal in the app, not just suggestions, since they all share the same underlying dialog component (`Sheet.jsx`'s focus-trap configuration was silently swallowing outside clicks before they could reach its own backdrop-click handler).

## [1.53.3] — 2026-07-29

### Fixed
- **Re-buying the same item no longer piles up duplicates in "Recently bought."** Adding an item that was already bought (e.g. adding "Milk" again a few days after last buying it) used to create a brand-new line, so buying the same staple repeatedly left several identical entries sitting in "Recently bought" instead of the one entry just moving back to the top. Adding it now reopens that same line (`POST /list` reuses the existing bought row instead of inserting a new one), so it re-sorts to the top the next time it's bought rather than duplicating.

## [1.53.2] — 2026-07-29

### Added
- **Checking off the last item on your shopping list now gets a small celebratory moment.** The summary line at the top used to just quietly reword itself from "3 items left" to "All done" — now it becomes a small green checkmark pill, and the space above "Recently bought" shows a "Nothing left to buy" note. This only plays its little pop-in animation the moment you actually finish the list; reopening the app or coming back later to a list that was already fully bought just shows the same pill and note immediately, with no animation, so it doesn't feel like it's replaying every time you glance at an already-finished list (`ShoppingListTab.jsx`'s `celebrate` state, gated on the specific item-toggle event rather than on the list simply being fully bought). The same celebration also plays for the "Mark all as bought" bulk action.

## [1.53.1] — 2026-07-29

### Changed
- **The empty shopping list now shows a small illustration instead of a plain icon.** Opening the shopping list tab with nothing on it yet used to show a generic cart icon and a line of text; it now shows a little basket drawing with a couple of items about to drop in, matching the style of the app's other illustrations (`EmptyState`'s new `illustration` slot, `EmptyListIllustration` in `ShoppingListTab.jsx`) so the empty list feels a bit more finished on a new household's first open.

## [1.53.0] — 2026-07-29

### Changed
- **The "Clear bought" button is now "Mark all as bought."** The old button on the "Recently bought" section deleted every already-bought item from the list, which also meant losing items someone had just bought minutes ago. It's replaced by a "Mark all as bought" action in the add (+) menu that instead flips every still-unbought item to bought, the same as tapping each one — nothing is deleted, and recently-bought items stay visible. (`POST /list/mark-all-bought` replaces `DELETE /list/bought`.)

## [1.52.1] — 2026-07-29

### Fixed
- **Opening the app from an old bookmark or shortcut no longer leaves a stray `/app` in the address bar.** `shop.panhandle.app` has served the app from its clean bare root for a while, but hitting `/app.html` or `/app` directly — e.g. a saved bookmark, a PWA shortcut, or browser autocomplete from before that change — just served the app in place without ever redirecting back to the clean URL. The Worker now 301-redirects `shop.panhandle.app/app.html`/`/app` to `shop.panhandle.app/`, matching the same clean-URL behavior everyone else already gets.

## [1.52.0] — 2026-07-29

### Added
- **New users now see a short, swipeable welcome tour the first time they open the app.** After signing up, or logging in on a new device for the first time, a four-slide intro walks through the shared shopping list, meal planning, offline support, and notifications before showing the empty list — skippable at any point. It's shown once per device rather than tied to the account (a second device, e.g. another household member's phone, still gets it), tracked by a small `ph_onboarding_seen_v1` flag (`src/lib/onboarding.js`). The slides (`OnboardingFlow.jsx`/`illustrations.jsx`) reuse the app's existing design tokens and motion settings — including respecting reduced-motion and the "classic" density preference — and are always in English regardless of device language, the same as meal names are never translated. It can also be replayed any time via Settings → About → "Show welcome tour", next to "What's new?" and "Send feedback" (`AboutFooter.jsx`) — this doesn't touch the first-login flag, it just re-shows the same tour as a full-screen overlay.
- **Adding someone to your household is now a shareable invite link instead
  of a generated password you have to hand over yourself.** Settings →
  Members now has a "Generate invite link" button instead of a name/email
  form — send the link to whoever you want to add, and they pick their own
  name, email, and password (or sign in with Google) when they open it. The
  old flow created an account with a random password up front, before the
  person had even agreed to join; the new one only creates an account once
  the invite is actually redeemed (`list_invites` table, single-use,
  SHA-256-hashed token, 7-day expiry — same pattern as password-reset
  links). Only one invite link is active per household at a time;
  generating a new one or revoking it invalidates whatever link was out
  there before.

## [1.51.7] — 2026-07-28

### Changed
- **The full changelog page now shows a short, plain-language summary per
  release instead of the full technical write-up.** `/changelog.html`
  previously rendered every release's complete bullet text, including
  internal implementation detail (file names, endpoints, table names) that
  doesn't mean much to someone who isn't a developer on the project. It now
  shows just each entry's lead sentence — the same simplification the
  in-app "What's new" modal already used for its last few releases — so the
  full page reads as a quick history instead of an engineering log. Every
  historical entry back to the first tagged version was reworded so its
  opening sentence stands on its own as a plain summary; the fuller
  technical detail is unchanged and still lives in this file for anyone who
  wants it (just not shown on either changelog surface anymore). A handful
  of entries that had been written only in Norwegian are now in English
  too.

## [1.51.6] — 2026-07-28

### Changed
- **New devices now open in English by default instead of Norwegian.** A
  device that opens the app for the first time now defaults to English
  unless its browser reports a Norwegian locale — the app is no longer
  assumed to be Norwegian-only. The static changelog page (`/changelog.html`)
  is now in English too, matching the landing and privacy pages. Anyone can
  still switch languages any time in Settings → Language.

## [1.51.5] — 2026-07-28

### Changed
- The "what's new" changelog no longer pops up automatically for every new
  version — only for a major version. Smaller updates still show a quiet
  "what's new" toast instead of interrupting you.

## [1.51.4] — 2026-07-28

### Fixed
- **A few leftover web addresses could still open the app instead of
  redirecting to its real home.** `panhandle.app` could still serve the app
  directly at a few path variants (`/app`, `/app/`, a doubled leading slash)
  instead of redirecting to `shop.panhandle.app` — the redirect only matched
  the exact literal `/app.html` path, so Cloudflare Pages' extension-stripped
  canonical URL (`/app`) and some slash variants slipped through unredirected.
  The redirect now normalizes the path first, so `shop.panhandle.app` is
  reliably the only place the app itself is ever served.

## [1.51.3] — 2026-07-28

### Changed
- **The app now lives at its own address, `shop.panhandle.app`.** It used to
  be reached at `panhandle.app/app.html`; `panhandle.app` itself keeps
  serving the marketing landing page, and old links to
  `panhandle.app/app.html` (bookmarks, password-reset emails already sent,
  etc.) redirect automatically to the new address. No other behavior changes.

## [1.51.2] — 2026-07-28

### Fixed
- **The marketing landing page now registers for offline support too, not
  just the app itself.** An automated install-readiness check was scanning
  the root domain and reporting no offline support found, even though the
  app itself has worked offline all along.

## [1.51.1] — 2026-07-28

### Fixed
- **Small groundwork to help the app pass Android app-store packaging
  checks — nothing visibly changes.** Filled in several missing fields in
  the app's install manifest (id, scope, language, layout direction,
  orientation, category) flagged by an automated install-readiness check.

## [1.51.0] — 2026-07-28

### Added
- **A privacy policy page** (`/privacy.html`), linked from the marketing
  page's and changelog page's footers — needed ahead of a Play Store
  listing.

## [1.50.4] — 2026-07-28

### Changed
- **Password-reset emails now send from Panhandle's own address** instead
  of a personal one, now that it's verified for sending. No other behavior
  changes.

## [1.50.3] — 2026-07-28

### Changed
- **Password-reset emails now link to `panhandle.app` instead of a personal
  domain.** Part of moving the app off a personal domain ahead of a Play
  Store listing — no other behavior changes; the app is still reachable at
  the old address too during the transition.

## [1.50.2] — 2026-07-27

### Added
- **Groundwork for a Google Play Store listing (Android app),** alongside
  the existing "Add to Home Screen" install option. No visible change yet —
  this adds the pieces needed to package and verify the app for Play, and
  makes the app's public address configurable instead of hardcoded so it
  can move off a personal domain before that listing goes live.

## [1.50.1] — 2026-07-27

### Changed
- **The person avatar on each day in the weekly meal plan is noticeably
  bigger,** in both compact and comfortable view.

## [1.50.0] — 2026-07-27

### Changed
- **The weekly meal plan is redesigned to show the whole week at a
  glance.** Days are now compact rows instead of big cards, so all 7 days
  fit on screen together without scrolling. A new toggle switches between
  Compact (one line per day) and Comfortable (a bit more room, spelling out
  who's cooking).
- **A day with a usual cook now shows that person consistently.** If
  nobody's confirmed a day yet but someone is normally responsible for it
  (e.g. every Wednesday), their avatar now shows up in the same spot a
  confirmed day's avatar would — just greyed out with a small badge —
  instead of a separate line of text elsewhere on the row.

## [1.49.0] — 2026-07-27

### Added
- **Panhandle now has a real desktop layout.** On a wide screen the app no
  longer sits in a narrow phone-shaped column: the tab bar becomes a proper
  sidebar down the left, the shopping list spreads out over the full width
  (six items across instead of three), the week's meals show more days at a
  glance, and pop-ups open as centred windows rather than sliding up from
  the bottom like on a phone. Phones and tablets are completely unchanged.

## [1.48.4] — 2026-07-27

### Changed
- **Clearer warning when forgetting an item completely from Settings/the
  item editor.** It now says plainly that this also removes it from
  "Recently bought" history, not just future suggestions.

## [1.48.3] — 2026-07-27

### Changed
- **The list/grid toggle on the shopping list is now one button.** It used
  to be two icon buttons that only reacted if you tapped the exact icon —
  miss it by a few pixels and nothing happened. Now the whole pill is a
  single button: tap anywhere on it, including directly on the icon that's
  already selected, and it switches.

## [1.48.2] — 2026-07-27

### Fixed
- **Most of the rows in Settings had lost their names.** Appearance,
  Account, Language, Notifications, Our home and Store layout all showed a
  blank line where the title should be — only their grey description text
  was left. All of them read properly again.

### Changed
- **"Our home" is split into two pages that make sense on their own.** It
  used to be one row labelled with the member count that opened a page
  containing both the member list and the weekly dinner schedule — and if
  you weren't an owner, the member list wasn't there at all, so the row
  promised "3 / 10 members" and delivered a dinner plan. Now there's
  **Household members** (owners only — the roster and adding/removing
  people) and **Dinner duty** (everyone — who cooks on each weekday).
- **Dinner duty is a lot shorter.** Each weekday and its picker now sit on
  one line instead of stacked, so the whole week fits on screen without
  scrolling.

## [1.48.1] — 2026-07-26

### Fixed
- **Picking ingredients from a single meal now tells you when everything
  you picked was already on the list.** Previously it silently said "0
  added" instead. Adding a whole week's ingredients already showed this
  message; now both places behave the same way.
- **A meal-name or ingredient dropdown could occasionally stay open after
  tapping elsewhere on screen.** It now always closes.

## [1.48.0] — 2026-07-26

### Changed
- **Groundwork, not a new feature: nothing about the app looks or behaves
  differently.** Under the hood the app's own "original" language is now
  English, with Norwegian as a translation of it — the reverse of how it
  was built. The app still opens in Norwegian, every screen still reads
  exactly the same in both languages, and your shopping list, aisle order
  and meal plans are all untouched. This only makes the next language
  easier to add.

### Fixed
- **The "not found" error was the one message that stayed in English even
  with the app set to Norwegian.** It now reads correctly in Norwegian too.

## [1.47.1] — 2026-07-26

### Fixed
- **The app now cleans up old cached files when it updates.** Every time
  the app was updated, the files from the previous version stayed behind
  in the phone's/browser's local storage instead of being deleted — over
  many updates this slowly built up. Now the previous version's files are
  removed automatically as soon as a new update is in use. No visible
  change in the app, just less storage space used over time.

## [1.47.0] — 2026-07-26

### Added
- **Error messages are translated now too.** Anything the server told you —
  "wrong email or password," "the list is full," "too many attempts" —
  used to come back in Norwegian no matter which language the app was set
  to. All 50 of those messages now follow your language. This was the last
  untranslated part of the app.

### Changed
- **Meal names and typed-in ingredients stay as you wrote them,** in
  whichever language you typed them. There's nothing to translate them
  against, and guessing would be worse than leaving them alone — so that's
  now a settled decision rather than an open one.

## [1.46.0] — 2026-07-26

### Added
- **Aisle names are now translated.** Switching to English translates the
  category names too — "Frukt og grønt" shows as "Fruit and vegetables" in
  the item editor's category picker and in the store-layout aisle-order
  list. Your saved aisle order is untouched by this; only the words on
  screen change.
- **The last Norwegian bits of shared chrome are translated.** Confirmation
  dialogs' Cancel button (it stayed Norwegian even inside otherwise-
  translated dialogs), the "Undo" button on toasts, the feedback form, the
  "what's new" dialog, the install banner and the important-items explainer
  all follow the language now.

### Not yet translated
- Meal names and typed-in ingredients, the changelog's own text, and error
  messages that come back from the server.

## [1.45.0] — 2026-07-26

### Added
- **Nearly the whole app is now translated.** Switching to English (Settings
  → Language) used to only change the shopping list; now the meal planner
  and all its dialogs, every Settings page, the tab bar and page titles, and
  the login/sign-up/forgotten-password screens follow the language too.
  Dates and weekday names switch as well, so an English app no longer says
  "mandag 27. juli," and the sign-in screens pick up your browser's
  language automatically on a first visit.
- **The invitation text you copy when adding a household member is now
  written in whichever language you're using.**

### Not yet translated
- Aisle/category names, meal names and typed-in ingredients, and error
  messages from the server. Aisle/category names need a separate change
  first, since they're also used as internal identifiers.

## [1.44.0] — 2026-07-26

### Added
- **The shopping list's item names are now translated too.** Switching to
  English (Settings → Language) no longer just translates the surrounding
  buttons and labels — the ~710 common grocery items (e.g. "Melk") now show
  their English name ("Milk") as well, in both list and grid view, in
  suggestions, and while editing. Typing in English (e.g. "milk") also
  finds the matching item so autocomplete keeps working regardless of
  which language you're typing in. A household's own custom/typed-in items
  aren't translated (there's no name to look up) and simply show as typed
  either way.
- **The language switcher is now a dropdown** instead of a two-button
  toggle, matching how other pick-one settings look in the app.

## [1.43.4] — 2026-07-25

### Added
- **Language support, phase 1: a Norwegian/English switcher.** Settings →
  Language now lets you pick the app's language, per device — it works
  like the existing theme setting (instant, no reload, no server round-
  trip). Only the shopping list tab is translated so far; the rest of the
  app (meals, settings, other screens) is still Norwegian-only for now and
  will follow in a later update.

## [1.43.3] — 2026-07-25

### Changed
- **The drag handle in Store layout moved to the far right.** In the list
  of item groups (Settings → Store layout), the drag handle sat between
  the item name and the up/down arrows. It's now moved to sit past the
  arrows, on the far right, as a clearer grab point.

## [1.43.2] — 2026-07-23

### Fixed
- **Internal database tidy-up — no visible change.** Cleaned up an internal
  inconsistency in the store-layout table and removed a couple of database
  fields for notification settings that were no longer in use, since
  reminders had moved to per-device in the previous update. Purely internal
  maintenance — no feature changes.

## [1.43.1] — 2026-07-23

### Changed
- **Settings now looks consistent all the way through.** The appearance
  options (theme, design and vibration) used to sit right in the main
  Settings list, while everything else opened its own page when tapped.
  Now appearance opens its own page too, so the whole Settings screen is
  one tidy list where every option behaves the same way. Options are
  grouped under "Me" (your device and account) and "Our home" (what you
  share), with "Notifications" on its own.

## [1.43.0] — 2026-07-23

### Changed
- **Notification reminders now only apply to your own device.** Meal-
  planning reminders ("No dinner planned for tomorrow" and the weekly
  planning reminder) are now controlled per device instead of shared for
  the whole household. Turning a reminder off or changing its time only
  affects your own phone or browser — nobody can switch reminders on or
  off for someone else anymore. Each member decides for themselves what
  they want to be reminded about, and when. (The reminder settings only
  show up on the Notifications page once you've turned notifications on
  for that device.) The "Notify the household" button works as before — it's
  a deliberate action to get everyone else's attention.

## [1.42.2] — 2026-07-23

### Fixed
- **"What's new" now shows the right version.** The window that pops up
  after an update to show what's new could lag one version behind — it
  showed the previous update's points instead of the newest one. It now
  always fetches the freshest changelog, so the window matches the version
  you're actually running (the same way the Settings page and the full
  changelog already did).

## [1.42.1] — 2026-07-23

### Fixed
- **"What's new" text is left-aligned again from Settings.** Opening the
  changelog from Settings' "What's new?" link centered the version headings
  and bullet text (while the bullet markers themselves stayed put on the
  left), because the dialog inherited centered text from the footer it was
  triggered from. All dialogs now always render left-aligned text
  regardless of where they're opened from.

## [1.42.0] — 2026-07-23

### Changed
- **Settings has had a spring clean.** The whole Settings screen is tidied
  up so buttons, switches, fields and lists look consistent from page to
  page, with a calmer, more consistent feel. "Sign out" no longer stands
  out like a main button, and your name is now saved automatically when
  you leave the field.
- **The "old items" setting has moved.** The choice for how long an item
  can sit unbought before it gets a discreet marker now lives under "Store
  layout" alongside the other shopping-list settings, instead of under
  "Notifications" where it didn't really belong.
- **Clearer about who a notification applies to.** The Notifications page
  now makes clear that turning on push notifications only affects your own
  device, while meal-planning reminders apply to the whole household.

## [1.41.1] — 2026-07-23

### Fixed
- **Settings no longer strands you on the wrong tab.** Drilling into a
  Settings sub-page (like Store layout or Notifications) and then
  switching to another tab before coming back could break the back
  button — tapping it, or the browser's back gesture, would dump you on
  an unrelated tab instead of the Settings list. Back navigation now
  always returns you to the Settings list correctly. Tapping the Settings
  tab icon again while inside a sub-page also now jumps straight back to
  the Settings list.

## [1.41.0] — 2026-07-23

### Added
- **Arrow-key navigation for add-item suggestions.** When you type in the
  "Add item" box, you can now press ↑/↓ to move a highlight down the
  suggestion list and hit Enter to add whichever one is highlighted,
  instead of having to reach for the mouse or type the name out exactly.
- **Drag-to-reorder store categories.** You can now drag the shopping-list
  categories into place instead of only nudging them one step at a time
  with up/down buttons. The settings page for this is also renamed to
  "Store layout" so it's clearer what it's for.

### Fixed
- **New common grocery items now reach every existing household
  automatically,** within about 15 minutes of a deploy. Previously this
  required a separate manual step — no visible change to how the app
  works.

## [1.40.0] — 2026-07-23

### Added
- **Match the list to your store.** You can now set the order of the item
  groups (fruit & veg, dairy, household…) to follow your own store's
  layout, under Settings → Store layout. The shopping list then sorts
  itself along the route you actually walk, so you're not backtracking
  across the shop. It's a shared setting for the whole household.
- **"Clear bought items" — clear everything you've bought in one tap.**
  When you're done shopping, a new button on the "Recently bought" section
  wipes all the checked-off items at once, instead of removing them one by
  one. The items themselves are remembered, so they still show up in
  search and suggestions next time.

## [1.39.1] — 2026-07-22

### Fixed
- **No more double notification on a quiet Sunday.** When the whole
  upcoming week had no meals planned, you could get two reminders back-to-
  back on Sunday evening — the weekly "plan next week" nudge and the daily
  "nothing planned for tomorrow" one. Now only the weekly reminder is sent
  in that case.
- **The "important only" filter turns itself off once everything important
  is bought.** Previously it stayed silently armed and re-engaged the next
  time you star an item.
- **Picking a reminder time now snaps to the nearest quarter-hour.** Typing
  an odd minute like 18:07 on a computer used to be silently rejected with
  an unhelpful error; it's now rounded to a valid time (e.g. 18:00) and
  saved.
- **The "from the meal plan" add no longer overcounts.** Ingredients
  already on your list are no longer counted as newly added in the
  confirmation message.
- **Small internal cleanup, no visible change:** a display name now
  resolves regardless of letter case, and some unused notification code
  was removed.

## [1.39.0] — 2026-07-22

### Added
- **Items you add or check off with no signal are no longer lost.** If you
  add an item or tick one as bought while offline — mid-shop in a dead
  spot, say — it's now saved on your device and sent automatically the
  moment you're back online, instead of quietly disappearing. A small
  counter next to the item summary shows how many changes are still
  waiting to sync.

## [1.38.1] — 2026-07-20

### Fixed
- **Saving a meal plan day no longer loses the other half of it.** Updating
  just who's responsible for a day could previously blank out the meal
  planned for it, and updating just the meal could previously blank out
  who was responsible — both are now preserved unless you actually change
  them. This wasn't reachable from the app's own screens (they always send
  both together), but closes the gap for any future partial save.

## [1.38.0] — 2026-07-20

### Fixed
- **"Add exactly as typed" now actually adds it exactly as typed.**
  Previously, an item containing "gf" or "glutenfri" still got that marker
  stripped out and a "Gluten-free" note added even when you chose the
  "add exactly as written" option — it wasn't truly verbatim. That option
  now saves the name untouched, with no automatic capitalization either.

### Added
- **Quantities with units are now recognized when adding an item.** Typing
  something like "2L milk," "500g cheese," "2 kg potatoes," or "3 stk egg"
  now splits into the right quantity and item name, with the unit kept as
  a note on the item — instead of the unit riding along as part of the
  name.

## [1.37.3] — 2026-07-20

### Fixed
- **Admin actions are now confined to your own household.** Resetting a
  password, changing someone's admin/owner access, and viewing the user
  list from the Admin screen now only reach people in your own list,
  instead of every household in the app. Creating a brand-new household
  from that screen is now limited to the app owner. This closes a latent
  cross-household access gap that only mattered once a second household
  gets an admin — nothing changes for the current single-admin setup.

## [1.37.2] — 2026-07-20

### Changed
- **Internal housekeeping only — nothing changes in the app.** Logged a
  fresh round of audit findings and future ideas in the project's own
  to-do notes. No user-facing behaviour was touched; the version bump is
  just to keep the deploy and changelog in step per the release
  convention.

## [1.37.1] — 2026-07-19

### Changed
- **Marking an item bought now clears its "important" star.** Important is
  meant for "this trip," not forever — checking an item off now drops the
  marker, so it doesn't carry over to your next shopping trip. Unchecking
  it again (undoing a bought mark) doesn't bring the star back. Since a
  bought item can never be important, the "Recently bought" section no
  longer shows the star badge or swipe-to-mark gesture at all.

## [1.37.0] — 2026-07-19

### Added
- **A quick way to see just your important items.** A small star chip next
  to the item count (only shown once something's marked important) pulls
  those items into their own "Important" section above the rest of the
  list — handy for a trip where you're not buying everything on the list.
  Nothing gets hidden: everything else stays right below, in its normal
  aisle order.

## [1.36.4] — 2026-07-19

### Fixed
- **The "how to mark important" modal's demos were hard to read.** The
  swipe/tap illustrations were abstract shapes with no item name or icon,
  making it unclear what was actually being demonstrated. They now show a
  real item (icon + name) — a different common one each time you open the
  modal — so it reads like an actual item on your list.

## [1.36.3] — 2026-07-19

### Fixed
- **Tapping "Update" on the update toast could reload into a blank white
  screen,** recoverable only by fully closing and reopening the app. The
  offline cache was serving the app shell itself stale-while-revalidate,
  so a reload right after a deploy could load old cached HTML pointing at
  files the new deploy no longer serves. The app shell now always prefers
  the network (falling back to the cache only when offline), so updates
  apply cleanly on the first reload.

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
  by hand with an old, inconsistent treatment. It's now a proper low-
  emphasis button matching the rest of the app.

## [1.36.0] — 2026-07-19

### Added
- **New features now announce themselves.** Updating to a release that
  adds a real new capability now opens a "what's new" modal automatically,
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
  shopping list tab is now a small star legend instead — tap it for a
  short how-to with a visual demo of both ways to mark an item important.
  Sync/offline status still shows there when it's relevant.

## [1.34.3] — 2026-07-18

### Fixed
- **Meal and weekly reminders could silently never fire.** Enabling push
  notifications turned both reminder toggles on in the UI, but the
  underlying setting never got created until you separately visited
  Settings and changed something — and the reminder check only sends to
  households that have one. Subscribing to push now creates that setting
  with the same defaults the UI already showed.
- **Shopping list items could briefly leak between users on a shared
  household device.** The local on-device cache wasn't cleared on logout,
  so the next person to log in could see the previous user's (different
  list's) items until the first background refresh. Logging out now
  clears the cached data.
- **Changing your password allowed a weaker minimum than signing up.**
  Changing your password only required 6 characters, letting you lower
  your password strength below the 8-character floor enforced at signup
  and password reset. Standardized on 8 everywhere.
- **The "been on the list a while" marker likely never showed on iOS
  Safari.** The date comparison relied on a format Safari doesn't reliably
  parse; it's now normalized before parsing.

## [1.34.2] — 2026-07-18

### Fixed
- **The importance star was on every item, not just important ones.**
  Every item's icon badge showed a star outline, with only a subtle color
  change once flagged — too easy to miss at a glance. Non-important items
  now show no star at all, so a flagged item actually stands out; the
  same tap area is still there to mark an item important in the first
  place.

## [1.34.1] — 2026-07-18

### Fixed
- **Push notifications showed a plain solid square instead of the app
  icon.** The status-bar badge reused the full-color app icon, but Android
  strips color from that image and fills in only its opaque pixels — since
  the icon had no transparency, the whole square came out solid. Push
  notifications now use a dedicated white-on-transparent silhouette for
  the badge, so Android can mask it correctly.

## [1.34.0] — 2026-07-18

### Added
- **Mark shopping list items as important.** Tap the small star badge on
  any item's icon to flag it — a quick, one-tap action separate from
  checking the item off, so you can flag something as urgent without
  navigating into the edit screen.

## [1.33.2] — 2026-07-18

### Fixed
- **A typo in your current password could log you out entirely.** Changing
  your password or email, or deleting your account, returned the same
  "unauthorized" status the app uses to detect an expired session — so a
  single wrong-password typo bounced you to the login screen with a
  misleading "your session expired" message instead of just showing "wrong
  password." These now return a distinct status the app treats as a
  normal, in-place error.
- **Deleting the last owner of a list could silently fail.** When a list's
  sole owner deleted their account (or a super-admin force-deleted a
  list), the cleanup skipped tracking of who's currently viewing the list,
  which blocked the final list deletion and aborted the whole operation.
  That's now cleared as part of the cascade.

## [1.33.1] — 2026-07-18

### Fixed
- **The "been on the list a while" marker looked like a new-item
  notification.** A stale shopping list item was flagged with a plain dot
  in the same top-right corner as an unread-notification badge —
  signalling the opposite of "this has been sitting here." It's now a
  small clock glyph instead, in both list and grid view.

## [1.33.0] — 2026-07-18

### Added
- **Every item in the shared catalogue now has an icon.** The name→icon
  lookup covered only 500 of the 710 seeded catalogue items, so the rest
  fell back to a plain first-letter badge in grid view. All 210 remaining
  items — niche produce, spices, meat/fish varieties, plant milks, noodle
  types, vitamins/first-aid items, cleaning/household sundries, candy
  brands, and the generic category headers (Meat, Fish, Fruit, Cheese,
  Bread, Flour, Oil, Cereal, Spreads) — now resolve to an icon, most
  reusing an existing drawing and seven backed by new hand-drawn art
  (artichoke, pregnancy test, gloves, broom, scissors, plus a cold-pack/
  heat-pack pouch pair).

## [1.32.5] — 2026-07-18

### Fixed
- **Shopping list rows were a different height depending on whether an
  item had a quantity or a note.** The qty/notes line under an item's name
  was only rendered when there was something to show, so rows without
  either collapsed to a single line while rows with them stretched to two
  — visibly uneven row heights in both list and grid view. That line now
  always reserves its space, whether or not it has content.

## [1.32.4] — 2026-07-18

### Fixed
- **Meal-week swipe snapped back to the wrong week the instant a new drag
  started.** The row's horizontal position was driven by two independent
  pieces of code at once, and the two could race, most visibly right as a
  new swipe began on a week other than the current one. The drag is now
  driven entirely by one consistent animation system, so there's a single
  owner of the row's position at any given moment.

## [1.32.3] — 2026-07-18

### Fixed
- **The "days before an item goes stale" setting couldn't be retyped.** The
  field validated on every keystroke and rejected any intermediate state
  (an empty box, a lone leading digit), so clearing it to type a new value
  never worked — only select-all-and-overtype did. Typing now always shows
  what you type, with an out-of-range or non-numeric value only resolved
  (clamped, or reverted to the last valid number) once you leave the
  field. Added +/- buttons alongside it for one-day nudges.

## [1.32.2] — 2026-07-17

### Fixed
- **Meal-week swipe only revealed the next week after releasing, not
  during the drag.** The previous fix gave the swipe a real slide, but the
  neighbouring week didn't exist on screen until the gesture committed, so
  dragging just moved the current week aside and revealed blank background
  underneath — the new week only appeared once you let go. All navigable
  weeks are now laid out side by side, with the current and immediate
  neighbouring weeks' real data kept ready, so dragging reveals the
  adjacent week's actual cards sliding into place as you go, the same way
  it moves out — not just after release.

## [1.32.1] — 2026-07-17

### Fixed
- **Meal-week swipe didn't actually slide, and could open the wrong day.**
  The drag gesture was constrained back to its starting position, so a
  swipe only ever rubber-banded a few pixels before the new week's cards
  popped in abruptly instead of sliding over. Because the card barely
  moved, releasing the drag also frequently left the pointer on top of a
  day card, which opened that day's edit modal — bound to the day from
  *before* the swipe, so saving it could silently write to the wrong
  date. Swiping now plays a real calendar-style slide (the current week
  moves fully off-screen as the target week slides in from the correct
  edge, showing a brief skeleton if its data hasn't arrived yet), and the
  drag gesture no longer lets a release-on-card fire that card's tap.

## [1.32.0] — 2026-07-17

### Added
- **Swipe between weeks in Meals.** The day-card stack can now be dragged
  left/right, as an alternative to the ‹ Previous/Next › buttons, to move
  between weeks.

### Fixed
- **The floating add-button briefly mispositioned when switching tabs.**
  The shopping list's and meal planner's floating action button (and its
  menu) could flash into the wrong place for the duration of the tab-
  switch slide animation, due to a CSS quirk in how the animation moved
  the tab pane. Switched to an animation approach that doesn't have that
  effect.

## [1.31.1] — 2026-07-17

### Fixed
- **Meals briefly showing as unplanned when switching weeks.** Navigating
  the meal planner to a different week updated the visible date range
  before that week's plan had finished loading, so for an instant every
  day flashed as unplanned against the still-loading data. The date range
  and plan data now update together once the fetch resolves.

## [1.31.0] — 2026-07-17

### Added
- **Instant loading for the shopping list and meal planner.** Both tabs now
  show the last-fetched data the moment the app opens, instead of always
  starting blank and waiting on the network — a returning user sees their
  real list/week plan immediately, silently refreshed in the background. A
  genuine first-ever load (nothing cached yet) now shows a shimmering
  skeleton shaped like the real rows/day-cards in place of the old generic
  spinner, so first paint doesn't jump. The meal planner also starts
  loading its data as soon as the app opens rather than only once you
  switch to that tab, fixing days briefly rendering as "unplanned" before
  the fetch had a chance to resolve.

## [1.30.1] — 2026-07-17

### Changed
- **Clearer empty-day cards in the meal planner.** An unplanned day used to
  look like every other day's card, just with muted italic text ("No meal
  planned") inside the same solid fill. It's now a dashed, unfilled
  outline — a card with nothing in it shouldn't be styled like one with
  something in it — with an active "Add meal" prompt in the accent colour
  and a small plus icon, instead of a passive statement in a colour that
  read as disabled.

## [1.30.0] — 2026-07-17

### Added
- **Switching tabs now slides and fades instead of an instant cut.** The
  tab you switch to now slides and fades in from the direction you came
  from, riding the same motion as the tab bar's own sliding indicator.
  Panes stay mounted exactly as before, so switching tabs still doesn't
  re-fetch. The calmer design-intensity settings and reduced-motion
  preferences collapse it the same way they already collapse everything
  else driven by these motion effects.
- **Whole-card tap target for meal day cards.** Each day in the meal
  planner used to require hitting a small "Edit"/"Add" button in the
  corner; the entire card is now the tap target, with a colour wash +
  ripple while held so it's clear the card itself — not just the corner —
  is interactive. The old button is now a quiet trailing label next to a
  chevron.

## [1.29.0] — 2026-07-17

### Added
- **Stale-item marker on the shopping list.** Unbought items that have sat
  on the list longer than a configurable number of days (default 7) now
  get a small discreet dot on their icon, computed purely from the item's
  own "added on" date — no new notification, push, or background job
  involved. The threshold is a shared household setting, editable from
  Settings → Notifications ("Old items on the shopping list").

## [1.28.1] — 2026-07-17

### Fixed
- **Fixed a crash (blank white screen) when opening the meal-plan modal**
  ("Edit"/"Add" on any day in the meal planner). The modal briefly renders
  only a loading spinner while its data loads, and the app's focus-
  management library couldn't cope with a dialog that has no focusable
  element at all — which then unmounted the whole app since there's no
  error boundary. The shared modal component now always gives that
  library a fallback focus target, so a loading modal with no other
  tabbable content no longer crashes.

## [1.28.0] — 2026-07-17

### Added
- **Chip/token editor for meal ingredients and labels.** The meal-plan and
  meal-edit modals' ingredients field, and the meal-edit modal's labels
  field, are no longer plain comma-separated text inputs — each entry is
  now a removable chip, added by typing + Enter (or comma) or picked from
  a dropdown. Ingredient suggestions are backed by the shopping list's
  item catalogue, so ingredients map cleanly onto catalogue names for the
  "add to shopping list" flow; label suggestions are backed by every label
  already used across the meal catalogue.
- **"Plan again" one-tap re-plan from the meal catalogue.** Each row in
  "All meals" now has a calendar icon next to it — tapping it assigns that
  meal to the next unplanned day in the week you're currently viewing
  (defaulting the responsible person to that day's recurring default) and
  confirms with an undoable toast, instead of requiring you to open a day,
  search the meal-name dropdown, and save.

### Changed
- **Strengthened the recurring-schedule hint and added a save
  confirmation.** The "Usually: {name}" tag shown on unplanned days in the
  meal planner's week view now uses a more visible primary tone with a
  repeat icon instead of a plain neutral tag. Saving a day's recurring
  responsible person in Settings → Our home now confirms with a "Saved."
  toast instead of only surfacing feedback on error.

## [1.27.3] — 2026-07-16

### Changed
- **Removed the collapse/expand pattern from Settings entirely.** The
  member list, add-member form, weekly-responsibility list, and the admin
  screen's various lists are now always directly visible instead of
  hidden behind a tap-to-expand section. Every subpage now shows its
  content immediately — a subpage already has the room, so nothing needs a
  second tap to reveal.

## [1.27.2] — 2026-07-16

### Changed
- **Renamed the shopping list's "get the other person's attention" button
  to "Notify the household."** The old label didn't say what was being
  said or to whom; the new one makes clear the button notifies the rest of
  the household. No behavior change.

## [1.27.1] — 2026-07-16

### Fixed
- **Made the Settings subpages consistent with each other.** Account and
  Notifications — the two subpages showing direct fields rather than
  expandable sections — now share one visual layout instead of each having
  its own ad-hoc styling. Also fixed the Admin screen's "Stats" row, which
  sat visibly out of line with the rows above it.

## [1.27.0] — 2026-07-16

### Added
- **Push notifications, phase 2: a weekly meal-plan reminder and an on-
  demand "get the other person's attention" ping.** Settings →
  Notifications gained a second reminder toggle+time for a Sunday-evening
  nudge that only fires if the upcoming week has *no* meals planned at
  all (not "few" — an unambiguous "planning hasn't started" signal,
  avoiding a nag threshold). The shopping list's floating menu gained a
  "Notify the household" action that pushes every other subscribed device
  on the list a fixed "needs your attention" notification, rate-limited to
  once per 2 minutes per household so repeated taps can't spam everyone.
  Both reuse phase 1's subscribe/settings infrastructure.

## [1.26.0] — 2026-07-16

### Changed
- **Settings redesigned as a two-tier grouped list with subpages,** instead
  of six always-open sections on one long scroll. The root screen now
  shows two compact grouped clusters — device-local preferences (design
  intensity, theme, vibration) and navigable rows (Account, Notifications,
  Our home, Admin) — each opening its own subpage with a back button, both
  in-app and via the hardware/browser back button. Account's fields are no
  longer hidden behind an expandable section now that a subpage has room,
  and its Sign out/Delete account actions are pulled into a visually
  distinct danger zone. The superadmin stats screen is promoted from a
  fold-out nested three levels deep inside Admin into its own full
  subpage.

## [1.25.0] — 2026-07-16

### Added
- **See who else has the shopping list open right now.** Above the item
  list, small overlapping avatars show any other household member who's
  actively viewing the list — no manual "I'm done editing" toggle to
  remember, since it's driven by the same background check the list
  already uses, and a person just drops off the row a few seconds after
  they leave the tab or go idle.

## [1.24.0] — 2026-07-16

### Added
- **Push notifications, phase 1: a "no meal planned for tomorrow"
  reminder.** Settings → Notifications now has an "Enable notifications"
  toggle that requests browser notification permission and subscribes
  this device, plus a shared household setting (any list member can
  change it) for a daily reminder time — a background check every 15
  minutes sends a push to every subscribed device on a list if tomorrow
  still has no meal planned by that time, deduped so it never sends twice
  for the same day. Push notifications on iOS only work for the app
  installed to the Home Screen (iOS 16.4+), not an ordinary Safari tab —
  Settings shows a hint when that's the case. Batched item-added
  notifications, a weekly meal-plan reminder, and a custom "get the other
  person's attention" ping remain future additions.

## [1.23.8] — 2026-07-16

### Fixed
- **Sheets and the floating menu now use a proper focus-trapping library**
  instead of a hand-rolled version. Every modal and the shopping/meal
  floating speed-dial menu now trap keyboard focus correctly, and
  background page scroll is now locked while a sheet is open — previously
  the page behind an open sheet could still be scrolled.
- **Checked-off shopping items now re-sort into "Recently bought" in sync
  with the real animation.** It previously used a hand-tuned timer instead
  — it now waits for the actual animation to finish before moving the row.
- **Small copy and spacing tidy-up in the "Probably out of" floating-menu
  modal.**

## [1.23.7] — 2026-07-16

### Fixed
- **"Probably out of" floating-menu modal now follows the design system.**
  Its "Add another item" action was a raw, hand-styled button instead of
  the shared button component every other modal footer uses — it now
  matches the rest of the app.

## [1.23.6] — 2026-07-16

### Fixed
- **Superadmin accounts can no longer be deleted at all, by anyone.**
  Deleting your own account, and the superadmin-only force-delete action,
  both now refuse outright — no override, unlike the existing last-owner
  cascade guard — the moment the target is a superadmin, whether it's a
  superadmin self-deleting or one deleting another. Superadmin status
  comes solely from a developer-controlled setting, so the only path back
  after a deletion would be a developer editing that setting by hand.

## [1.23.5] — 2026-07-16

### Added
- **A real favicon.** The site previously had no browser-tab icon at all
  (just a home-screen icon), so browser tabs and bookmarks fell back to a
  generic globe/blank icon. Added a crisp icon that works at any size,
  with fallbacks for older browsers — all matching the same mark the app
  icons already use, so the tab icon now matches the home-screen/PWA icon.

## [1.23.4] — 2026-07-16

### Changed
- **Internal documentation cleanup only — no functional change.** Trimmed
  the project's internal developer notes to cut overhead on every new
  development session; detailed reference material that isn't needed
  day-to-day moved to a separate reference doc, read on demand instead of
  always preloaded.

## [1.23.3] — 2026-07-16

### Fixed
- **The icon/letter circle on list-view item cards was clipped by the
  card's rounded corner.** A styling bug left list rows with no padding at
  all, so the badge sat flush against the card's corner and got cut off
  by it. Fixed so list rows get their normal padding back.

## [1.23.2] — 2026-07-16

### Fixed
- **Member list in Settings showed a stray "0 0" next to non-admin, non-
  owner members** (e.g. "Saffa 0 0"). A display bug meant a member with
  neither an Owner nor Admin badge showed a literal "0" for each instead
  of nothing. Fixed so a member with neither flag shows just their name.

## [1.23.1] — 2026-07-16

### Added
- **A full changelog page, linked from the landing page footer and the
  in-app "What's new" modal.** Previously that link went off-domain to the
  file on GitHub; it's now a page on the site itself.

### Changed
- **Landing page copy no longer assumes exactly two people.** Panhandle
  supports a household of one to ten people, but the landing page's hero
  and feature copy was still written as if for exactly two people, from
  before multi-person households were supported. Reworded to talk about
  "the household"/"everyone" instead.

## [1.23.0] — 2026-07-16

### Added
- **Every account now has a name, e-mail, and username, editable in
  Settings — and the username always mirrors the e-mail.** Settings gained
  a "Name" field, shown throughout the app (shopping-list "added by," meal
  responsible avatars/dropdowns, member lists) instead of the raw username/
  e-mail. Signing in with Google now seeds name/e-mail from your Google
  profile the first time (never overwriting a later local edit). Changing
  your e-mail now renames your username to match everywhere it's stored
  (shopping items, meal-plan responsibility, recurring schedule) and signs
  you into a fresh session automatically. Adding a household member or a
  new owner now asks for their name and e-mail instead of a freeform
  username. Existing accounts whose username didn't already match their
  e-mail were migrated directly in production.

## [1.22.7] — 2026-07-16

### Changed
- **The in-app changelog ("What's new") now shows entry titles only, not
  the full text of every release.** It previously dumped the raw changelog
  file verbatim into a scrollable block. It now shows just each version's
  lead sentence and links out to the full changelog for anyone who wants
  the complete description.

### Docs
- **Internal to-do notes reorganized.** Completed items moved to their own
  file, numbered sequentially; open items are now grouped into themed
  sections with an explicit priority ranking instead of one flat list.
- **Repo documentation cleanup pass**: fixed several stale claims across
  the project's internal docs and removed a little dead code found along
  the way. No user-facing change.

## [1.22.6] — 2026-07-16

### Changed
- **The "Install Panhandle" install prompt in Settings no longer stays at
  full size forever.** It previously showed the same large, high-contrast
  prompt on every visit until you installed the app in that exact
  browser tab — so someone who'd already installed but opened the site in
  an ordinary browser tab kept seeing the full prompt every time. Now:
  the full prompt (unchanged) is still the default for anyone who hasn't
  installed or interacted with it. Once installed, it demotes to a
  compact filled pill rather than disappearing outright, since that signal
  can go stale after an uninstall. A new dismiss ("×") button on the full
  prompt demotes it further, to a plain text row, since an explicit "not
  now" is a stronger signal than an inferred one.

## [1.22.5] — 2026-07-15

### Security
- **Removed a one-time account-bootstrap page that was no longer needed.**
  It was a secret-gated route for creating the very first account(s) of a
  fresh deployment, meant to be disabled after first use — but since self-
  service signup and "Sign in with Google" now cover account creation, it
  was no longer needed and was still a standing (if secret-gated) attack
  surface. Removed the page and every reference to it.

## [1.22.4] — 2026-07-15

### Fixed
- **The meal planner's "Edit"/"Add" button on today's card was hard to
  read, in both light and dark mode.** Today's card flips to an inverted
  colour scheme, but the button didn't flip its own colours to match,
  leaving low-contrast text either way. It now uses matching colours on
  today's card.
- **Switching the shopping list between grid and list view changed what
  was in "Recently bought," not just how it looked.** The section capped
  at a different number of items per view to fill out each layout's rows,
  so toggling the view made items appear or disappear. It now shows the
  same fixed set of items in both views.
- **Meal planner week view: non-today day cards are more compact** (smaller
  padding, tighter spacing) so the week takes up less vertical space
  overall.

## [1.22.3] — 2026-07-15

### Docs
- **Internal developer documentation had drifted out of date** relative to
  the actual app. Brought back in sync (missing features, stale notes, an
  out-of-date setup guide marked as historical) — no code changes.

## [1.22.2] — 2026-07-15

### Fixed
- **The app had no visible edge on a desktop-width window.** The layout was
  already centered on wide screens, but shared the exact same background
  as the surrounding page, so it was hard to tell where the app ended. On
  wider viewports, the page now gets a contrasting backdrop and the app
  sits in a bordered, shadowed frame.

## [1.22.1] — 2026-07-15

### Fixed
- **"Sign in with Google" could go missing from the login screen after a
  session timeout.** When your session expires, the app drops back to the
  login screen in place, without a full page reload — but Google's sign-in
  button can silently fail to draw itself if the page has been open a long
  time (exactly how a session timeout happens). The login screen now
  always fetches a fresh copy of Google's sign-in script when it's shown,
  matching what a real page reload would do.

## [1.22.0] — 2026-07-15

### Added
- **Superadmin can now delete a list's last owner (and the whole list with
  it).** Deleting any other user under Admin still just deletes that
  account, but deleting a list's sole owner used to be flatly refused. It
  now shows an explicit warning that this permanently deletes the entire
  list (items, catalogue, meals) for everyone on it, and only proceeds on
  confirmation.

### Fixed
- **New lists were seeded with a much smaller item catalogue than existing
  ones.** A real household already hit this in production. Every new list
  now gets the same full ~710-item catalogue as older ones; existing
  under-seeded lists were backfilled directly.

## [1.21.9] — 2026-07-15

### Fixed
- **Checking off an item could leave it stuck in the list.** Marking an
  item bought sometimes left a faded, unclickable ghost row in place
  instead of reflowing the rest of the list — most reliably if you
  switched to another tab and back while the "checked off" animation was
  still playing. The shopping list now cleanly resets its item animations
  whenever you return to the tab. Also stopped an unnecessary extra list
  refresh on every toggle that could let two rapid taps' results arrive
  out of order.

## [1.21.8] — 2026-07-15

### Fixed
- **Trailing quantities in new item names weren't parsed.** Typing "2
  milk" correctly split into item "Milk" with qty 2, but "Milk 2" was
  added as a literal new catalogue item called "Milk 2" instead of "Milk"
  with qty 2. A leading or trailing number below 20 is now parsed as the
  quantity either way; larger numbers (e.g. "Yoghurt 500") are still left
  alone since they're usually part of the product size/name.

## [1.21.7] — 2026-07-15

### Changed
- **Grid ⇄ list now animates.** Switching the shopping list's view toggle
  used to snap instantly. Cards now morph smoothly between the row and
  tile shape, ripple in with a slight stagger under the default design
  intensity, and the icon/text ease into their new spot instead of
  popping. The List/Grid toggle buttons also gained a sliding indicator.
  The calmer "Classic" intensity is unaffected — it still forces list view
  with no motion.

## [1.21.6] — 2026-07-15

### Changed
- **Settings tab decluttered.** Every subsection now starts minimized, and
  opening one automatically closes any other that was open in the same
  section instead of letting them stack up. The three main sections now
  each carry a clearly separated title strip, and the "Install Panhandle"
  prompt moved to the top of the screen.

## [1.21.5] — 2026-07-15

### Fixed
- **Shopping list grid-view icon badges looked misaligned.** Badges now
  line up consistently across a row regardless of whether an item has a
  qty/notes subtitle. The hand-drawn icons are also now optically centered
  in their circle — each icon's true visual center is now computed and
  corrected individually.

## [1.21.4] — 2026-07-14

### Changed
- **Feedback emails now identify the sender more reliably.** The Worker
  now also looks up the sender's account email (if they have one on file)
  and sets it as the email's reply-to address, so replying from the
  recipient's inbox goes straight to that person instead of the shared
  sending address.

## [1.21.3] — 2026-07-14

### Added
- **Send feedback from the app** (Settings → "Send feedback," next to
  "What's new?"). A small modal with a free-text message emails the app's
  feedback address — no ticketing system needed for a small app.

## [1.21.2] — 2026-07-14

### Fixed
- **Landing page's shopping-list mockups were stale.** They showed a
  per-category header row above groups of items — a UI pattern the real
  app no longer has; unbought items have rendered as one flat, aisle-
  sorted list/grid with no category dividers for a while now. Removed the
  fake headers from both mockups; "Recently bought" keeps its own label,
  since that section is still real.

## [1.21.1] — 2026-07-14

### Added
- **Let the super-admin delete a user account outright** (Settings → Admin
  → "All users" → "Delete," superadmin-only). This is more consequential
  than the existing admin actions, which only ever demote/reset/remove-
  from-one-list, so it's gated further to superadmin only. Refuses
  (doesn't cascade) if the target is the last admin site-wide or the last
  owner of their list, mirroring the existing safeguards elsewhere — the
  superadmin promotes/reassigns someone else first, same as any admin
  already has to when demoting the last admin/owner.

## [1.21.0] — 2026-07-14

### Added
- **Let a user delete their own account** (Settings → Profile → "Delete
  account"), requiring current-password confirmation plus an explicit
  confirm dialog. A non-owner (or an owner with a co-owner) just leaves
  the list; the list's last/sole owner cascade-deletes the entire list —
  shopping list, meal plan, catalogue, recurring schedule, and every other
  member's account — since there's no "reassign ownership" flow yet and
  blocking self-deletion outright would leave solo/last-owner accounts
  with no way to close their account at all.

## [1.20.3] — 2026-07-14

### Changed
- **The recurring meal responsibility section in Settings can now be
  minimized,** defaulting to open, so nothing changes at first glance.

## [1.20.2] — 2026-07-14

### Fixed
- **iOS "Add to Home Screen" used a screenshot thumbnail instead of the
  app icon.** Safari there ignores the app's install-manifest icons for
  home-screen installs entirely — added a dedicated home-screen icon link.
- **Auth screens (login/signup/forgot/reset password) could clip or show
  a phantom scrollbar on iOS Safari** as the address-bar/toolbar chrome
  showed/hid. Fixed by using a viewport measurement that accounts for
  that chrome.

## [1.20.1] — 2026-07-14

### Fixed
- **Landing page's "Sign up" button.** It still opened a static "we're in
  closed beta, contact us" modal, a leftover from before self-service
  signup existed — now links straight to the real signup screen. The dead
  modal was removed.

## [1.20.0] — 2026-07-14

### Added
- **Self-service signup, "Sign in with Google," and email-based password
  recovery.** Anyone can now create their own household directly from the
  login screen ("Create new household") — no more asking the developer to
  create an owner account by hand. Signup is protected by a CAPTCHA plus
  an IP rate limit, and a Google sign-in with a matching email links onto
  an existing password account instead of creating a duplicate. Email
  delivery is via a transactional email provider.
- **Add/change your email from Settings → Profile.** Existing accounts
  created by an admin/owner have no email on file, so without this there
  was no way for them to link a Google sign-in or use password recovery
  short of a manual database edit.

## [1.19.3] — 2026-07-14

### Changed
- **Small internal consistency cleanup** across a couple of Settings
  components and modal headings — no visible change.

### Removed
- A couple of leftover, unused pieces of styling/code.

## [1.19.2] — 2026-07-14

### Changed
- **Bigger tap targets** on the suggest-item add button and the meal-name
  dropdown arrow, closer to standard touch-target sizing guidelines.
- **Admin/member user rows now animate in/out** the same way the rest of
  the app does (respecting reduced-motion/design-intensity settings).

### Investigated
- Confirmed a couple of previously-flagged layout concerns were already
  fine. No code change needed for either.

## [1.19.1] — 2026-07-14

### Fixed
- **Settings no longer redoes its counts and lists every time you open
  it.** Previously it re-fetched everything on every visit instead of
  staying loaded like the other two tabs.

## [1.19.0] — 2026-07-14

### Added
- **A proper confirmation dialog now consistently gates every destructive
  or sensitive action.** Two that previously had no confirmation at all now
  do too: deleting a planned meal day, and changing a user's admin/owner
  access.
- **Loading and empty states are now consistent across the app.** The
  shopping list and meal planner now show a loading indicator on their
  initial fetch instead of looking indistinguishable from a genuinely
  empty list/week, and several modals that used to render blank while
  loading now show the same indicator.

### Changed
- **Meal-plan save/delete now feel instant** (updates locally right away,
  rolls back with a toast on failure) instead of blocking the modal open.
  Matches the shopping list's item-toggle behavior.
- **Error and confirmation feedback across Settings and the item/meal edit
  modals is now consistently a toast.** Previously it was a mix of inline
  colored text, browser pop-ups, and silently dropped failures.

## [1.18.4] — 2026-07-14

### Changed
- **Consolidated several hand-styled buttons, inputs and badges onto the
  shared design system.** No visible change, just more consistent under
  the hood.

## [1.18.3] — 2026-07-14

### Fixed
- **Recurring-meal responsibility save failures are now shown to you**
  instead of failing silently.
- **The invite-copy button now shows success/failure via toast** and only
  closes the modal after a successful copy.

## [1.18.2] — 2026-07-14

### Accessibility
- **Shopping-list item cards are now reachable and operable by keyboard/
  screen reader,** matching the pattern already used elsewhere in the app.
- **Modals now move focus in on open, trap Tab inside the sheet, and
  restore focus to the trigger on close,** with proper screen-reader
  announcements.
- **Every form field is now properly labelled for assistive technology,**
  including password fields that previously relied on placeholder text
  alone.
- **Fixed a low-contrast text colour** that didn't quite meet accessibility
  contrast guidelines.
- **The back button now has a screen-reader label**, and the toast
  notification area now announces itself to screen readers.

## [1.18.1] — 2026-07-14

### Fixed
- **Switching tabs still visibly "flew in" cards from the top-left
  corner,** even after an earlier fix for the same symptom. A remaining
  animation-measurement quirk meant reactivating a tab could measure its
  cards' old position as pinned to the top-left corner for one frame, so
  everything appeared to fly in from there. Fixed by only enabling that
  measurement while the tab is actually active.

## [1.18.0] — 2026-07-13

### Added
- **Site-wide admin metrics dashboard.** A new stats section (superadmin-
  only) shows usage across every list: user/list counts, signups and new
  lists per week, shopping activity, meal-plan fill rate and most-planned
  meals, and a per-list breakdown table.

## [1.17.2] — 2026-07-13

### Fixed
- **Deleting a meal from the meal planner could silently wipe who's
  responsible for that day.** Removing a meal from the catalogue used to
  delete the whole day's plan entry — including the responsible person —
  instead of just unassigning the meal. Deleting a meal now correctly
  reverts the day to unplanned while keeping who's responsible.
- **The shopping list's delete button forgot the whole item, not just the
  line.** Deleting an item from the shopping list cleared its saved
  category and purchase history and removed every matching line on the
  list, even ones you didn't mean to touch. Delete now just removes the
  tapped line; a separate, clearly-labeled "forget this item entirely"
  option is still available if you actually want to reset its history.
- **A mistyped date sent from a broken client could get stuck in the meal
  plan.** The server now rejects a malformed date instead of silently
  accepting it.

### Security
- **Hardened a one-time account-setup check against timing attacks.**
  Changing your password is now also rate-limited the same way login
  attempts are, so a stolen device token can't be used to endlessly guess
  your current password.

## [1.17.1] — 2026-07-13

### Fixed
- **The shopping list's grid view could settle on 2 columns instead of
  3** on narrower phone widths. Fixed the sizing so it reliably lays out
  up to 3 columns.
- **The Android/browser back button no longer closed open modals.** A
  past rewrite dropped that integration entirely — pressing back while
  any modal was open just stepped through the tab-switch history
  underneath it, leaving the modal stuck open. Modals now correctly
  respond to the back button/gesture again.

## [1.17.0] — 2026-07-13

### Added
- **A visual redesign, with a new "design intensity" setting.** A new
  control lets you dial the app's visual language between **Expressive**
  (default — asymmetric "blob" card shapes, heavier display type, full
  spring animation), **Muted** (symmetric shapes, shorter linear motion),
  and **Classic** (flat corners, no animation, forced list layout — a
  calmer, more accessible option).
  - **The shopping list now groups items into colored "aisle" clusters,**
    with an adaptive grid that reflows as you check items off.
  - **The meal planner's "Today" card is now visually prioritized,** with
    its own shape, larger type, and bigger responsible-person avatars.
  - **Settings is now 4 grouped sections instead of a drill-down menu,**
    with a big install-app prompt and a 2×2 admin stats dashboard.

## [1.16.1] — 2026-07-13

### Fixed
- **The floating add-button's open animation flashed a hard square** for
  an instant before settling into its rounded shape. Fixed the animation
  curve so it stays rounded the whole way.

## [1.16.0] — 2026-07-13

### Added
- **Expressive motion — the app now feels physical and native.** Motion
  moved from a flat fade to a restrained, springy animation style, so
  interactions settle with a little life instead of snapping — and
  everything still fully honours the "reduce motion" accessibility
  setting.
  - **The floating menu** items spring up in a stagger, and the button
    morphs: the circle becomes a squircle and the "+" rotates into a
    close "×."
  - **Bottom sheets** spring up as they open.
  - **The bottom nav** now has a single indicator pill that slides between
    tabs, with the active icon filling and lifting.
  - **Checking off an item** gives a quick "pop" before it shrinks and
    re-sorts into "Recently bought."
  - Buttons get a springy press.
- **More haptic feedback, coupled to motion.** A light tick on switching
  tabs, opening the floating menu, and picking one of its actions
  (respecting the existing haptics toggle).
- **Emphasized headings** — screen titles use a larger, heavier type style
  so they carry a bit more personality.

## [1.15.0] — 2026-07-13

### Added
- **A real floating action menu.** Tapping the "+" on the shopping list
  and meal-plan tabs no longer opens a pop-up dialog — it now expands a
  proper speed-dial menu: the button morphs to a close "×," a scrim fades
  in, and the labelled actions rise in a stack above it.
- **Subtle press feedback** on buttons — a tonal wash on hover/press,
  layered on top of the existing tap ripple.

### Changed
- **Design refresh.** The design system's visual tokens were migrated to a
  fuller, more consistent system: colours, type, shape and elevation all
  redone on a coherent scale, keeping the same warm brand colours. Dark
  mode was rebuilt as a proper dark scheme.

### Added (continued)
- **Real offline app-shell caching.** The app previously registered a
  background service worker that only satisfied the "installable" PWA
  criteria and passed every request straight to the network. It now
  actually caches the app shell so the app loads offline; live data
  requests always still hit the network directly.

### Fixed
- **Modals now close on Escape.** None of the app's modals responded to
  the Escape key before — only the dimmed backdrop or an explicit close
  button worked, which could read as the app being stuck.

## [1.14.0] — 2026-07-13

### Changed
- **Shopping list's "+" button now leads with the meal plan.** Tapping the
  "+" opens a chooser: the primary action, **"From the meal plan,"** pulls
  every ingredient from this week's or next week's planned meals into a
  checkable list — pick what you need and add it in one go. The old
  "Probably out of" recommendations are still there, now as the secondary
  option in the same menu.

## [1.13.0] — 2026-07-12

### Added
- **Android-style tap ripple on every primary button.** A brief circular
  ripple spreads from the point you tapped, on top of the existing press
  feedback.
- **A clear destructive/"danger" button style**, used for all "delete/
  remove" actions.

### Changed
- **Redesigned the delete buttons.** Delete actions were previously a
  plain grey cancel button with red text, which read as disabled rather
  than destructive. They're now proper red-outline buttons (with a trash
  icon) that fill red on press.

## [1.12.8] — 2026-07-12

### Fixed
- **Fixed being logged out on every fresh app load.** A startup-ordering
  bug meant the very first request(s) after any fresh app load —
  including reloading via the "new version available" toast — went out
  with no login token, got rejected, and logged out an otherwise perfectly
  valid session. Fixed the startup order so the token is always ready
  before anything can request it.

## [1.12.7] — 2026-07-12

### Added
- **App mark on the "About" settings page.** The redesigned app icon was
  live everywhere except the one in-app screen where a small brand mark
  is conventional — the About page now shows the same mark used on the
  login screen, next to the version number.

## [1.12.6] — 2026-07-12

### Changed
- **Brought the login screen and landing page in line with the redesigned
  app icon.** A previous update redesigned the installable app icon but
  left the login screen's and landing page's logo on the old design, so
  the app briefly had two different logos live at once. Both now use the
  same updated logo design.

## [1.12.5] — 2026-07-12

### Changed
- **Redesigned the app icon for Android's adaptive-icon treatment,**
  inspired by a bold, high-contrast style. The old icon (a small pan
  floating on a cream background with a thin low-opacity ring) shrank to
  an illegible smudge once Android's launcher masked and scaled it down.
  Replaced it with a single new design: a full-bleed solid terracotta
  square with a bold cream pan-and-handle glyph, sized so it reads clearly
  at both full size and small launcher scale, and holds up under any
  Android icon mask shape.

## [1.12.4] — 2026-07-11

### Fixed
- **App icon was off-center with the handle clipped off.** A rendering
  quirk in the previous fix left the icon mark positioned too high,
  invisible on a laptop screen but glaring once cropped into Android's
  adaptive-icon shape. Recomputed the icon's position and pulled its
  content further inside the safe zone so it sits safely inside Android's
  circular/squircle crop with margin to spare.

## [1.12.3] — 2026-07-11

### Fixed
- **App icon had the wrong crop and an unwanted background.** The
  previous update's regenerated icons kept the wrong margin and an
  unwanted solid background. Recropped the icons tightly around just the
  pan shape and made the background transparent where it should be.

## [1.12.2] — 2026-07-11

### Fixed
- **Android install was still falling back to a plain shortcut instead of
  a real app install.** All three of the app's install icons had
  corrupted image data ever since an earlier rewrite — a valid install
  manifest and offline support weren't enough, since Chrome's install
  check also requires a decodable icon. Regenerated all three icons from
  the existing brand mark, and added a safeguard so this can't silently
  recur.

## [1.12.1] — 2026-07-11

### Fixed
- **Item icons were invisible.** The catalogue icon drawings are white-
  on-transparent, meant to sit on a solid colored tile, but a redesign
  gave their badge a pale cream background instead, making every icon
  effectively invisible. Badges (list and grid view) now use a solid
  colored background with correctly sized icons.

## [1.12.0] — 2026-07-10

### Added
- **Motion, so the app feels native.** Shared animation timing now backs
  all animation across the app.
- **Checking off an item now animates.** Instead of instantly vanishing, a
  ticked-off item strikes through and fills its checkbox in place, then
  briefly fades and shrinks out before re-sorting into "Recently bought."
  Applies to both list and grid view.
- **Bottom sheets now slide up** with a fading scrim when opening, instead
  of popping in.
- **Touch press feedback**: buttons give a light physical "shrink" on tap.
- Honors the "reduce motion" accessibility setting.
- **Installable as an app again on Android.** Added a minimal background
  service worker so Chrome offers the real "Install app" path instead of
  only "Add to home screen." No offline support yet — that's a separate
  follow-up.

### Changed
- **The Settings menu rows got a visual refresh** to match the card look
  of the other tabs.
- **Small copy tidy-up** on the shopping-list summary text.

## [1.11.0] — 2026-07-10

### Changed
- **New visual design across the whole app:** a warm terracotta/sage
  colour palette, new typography, a new icon set, and rounded pill-shaped
  components. A dark-mode palette was authored to extend the app's
  existing light/dark/system theme toggle. New install icons and colours
  adopt the same brand. No functional changes: same features,
  same data, same login.

## [1.10.0] — 2026-07-10

### Changed
- **Frontend rewritten in React.** Replaces the original hand-rolled
  single-file app with a modern component-based app, built and deployed
  the same way as before. All three tabs (shopping list, meal planner,
  settings) are fully ported, plus the update-available toast, install
  prompt, and browser back-button navigation for tabs/settings. No user-
  facing behavior changes are intended — this is an internal rewrite of
  the same app.

### Known gaps vs. the previous frontend
- Swipe-to-toggle, long-press-to-edit, and back-button support within
  modals weren't ported yet at this point. They followed in later updates.

## [1.9.2] — 2026-07-07

### Fixed
- **Toggling one item while another's animation was still playing could
  cause a visual flicker.** The list is now aware of which items are still
  mid-animation and preserves that state across re-renders.

## [1.9.1] — 2026-07-07

### Fixed
- **List view: item name text now lines up vertically with its icon**
  for items with no quantity or notes (the common case).

## [1.9.0] — 2026-07-06

### Added
- **Set a default responsible person per day of the week** (Settings →
  "Weekly recurring responsibility"). The default is shown in muted
  italics on unplanned days in the meal plan, and pre-fills the
  responsible dropdown when adding a new meal. It's always overridable
  for any individual day.
- **An "Other" option in the responsible dropdown** (meal modal): select
  "Other..." to type a custom label such as "Eating out" or "Guests are
  cooking."

## [1.8.1] — 2026-06-22

### Added
- **A brief shrink/fade animation when marking an item bought or
  unbought.** Toggling no longer just teleports the row from one place to
  another.

## [1.8.0] — 2026-06-20

### Added
- **A toggle to turn haptic feedback (vibration) on/off** in the profile
  settings (default on); short vibration on checking off, adding, or
  deleting an item.

### Fixed
- **Swiping down at the top of a list no longer triggers a full page
  reload.** Content scrolling now contains the overscroll instead of
  bubbling up to the browser's native pull-to-refresh.
- **The header, tab bar, add button, and toast now respect the device's
  notch/gesture-bar safe areas** instead of running underneath them.
- **Added iOS-specific tags for a cleaner standalone/install experience**
  on iOS.

## [1.7.0] — 2026-06-20

### Added
- **The app now prompts you to refresh as soon as an update is
  available,** while a tab stays open, instead of only detecting it on
  the next fresh page load. Never reloads on its own, so an in-progress
  edit isn't lost.

## [1.6.2] — 2026-06-20

### Fixed
- **The dropdown arrow on the meal-planning field didn't open anything
  when clicked** on some browsers. Replaced with a custom dropdown that
  reliably opens on click or focus and filters as you type.

## [1.6.1] — 2026-06-20

### Added
- **Free-form labels on meals** (e.g. "Dinner," "Vegetarian"), shown as
  chips in "All meals" and filterable there via a dropdown. Add them in
  the meal editor, with autocomplete from labels already used.

## [1.6.0] — 2026-06-20

### Added
- **Suggestions for items you're probably out of,** ranked by how overdue
  they are against how often you usually buy them. Surfaced via a badge on
  the shopping tab's add button — tapping it opens a sheet to add
  suggested items with one tap.

## [1.5.0] — 2026-06-20

### Added
- **A "what's new" toast the first time a device opens the app after a new
  version has been deployed,** with a button that opens a changelog modal.
  Also reachable any time from Settings → About → "What's new?"

## [1.4.2] — 2026-06-20

### Removed
- **Removed the "Sort list" toggle on the shopping list tab.** Its visual
  state and effect were unreliable enough that it read as broken; the list
  always renders in default category order now.

## [1.4.1] — 2026-06-20

### Fixed
- **The Android/browser back button did nothing sensible inside the
  app.** Pressing it while a modal was open, mid-drill-down in Settings,
  or on other tabs just exited the standalone app instead of stepping
  back one level. Back now correctly closes the modal / returns to the
  previous subpage or tab first, matching what a user expects. Escape now
  also closes an open modal.

## [1.4.0] — 2026-06-20

### Changed
- **Renamed the "Profile" tab to "Settings" and restructured it into a
  category list.** Profile, Members, Admin, and About are now each their
  own drill-down subpage instead of one long scrolling page. No
  functionality changed, only how it's organized.

## [1.3.0] — 2026-06-20

### Added
- **The meal tab's add button now opens a small chooser** ("New meal" /
  "Edit meals") instead of going straight to the new-meal editor. Editing
  an existing meal is just as common a reason to tap it.
- **The new-meal/edit-meal modal now flags name collisions as you type.**
  An exact match against another meal blocks saving early, and a similar
  name shows a "Looks like: …" hint, so near-duplicates are caught before
  they're saved.
- **A floating add button on the shopping list tab** — for now it just
  jumps focus to the add bar; a fuller quick-add flow may follow.

## [1.2.1] — 2026-06-20

### Changed
- **"+ New meal" moved off the meal tab's header onto a floating action
  button,** anchored bottom-right of the tab. Matches the prominence a
  primary "add" action warrants.

## [1.2.0] — 2026-06-19

### Added
- **A meal editor:** "+ New meal" adds a meal to the catalogue with its
  ingredients without assigning it to a day. Clicking any row in "All
  meals" opens the same editor to rename a meal, edit its ingredients, or
  delete it from the catalogue entirely — previously meals could only be
  created/edited implicitly by planning a day.

## [1.1.0] — 2026-06-19

### Added
- **Meal suggestions:** the meal-planning modal now shows quick-pick chips
  for meals eaten often but not in the last 10 days.
- **"All meals"** — a read-only, filterable browse view of every saved
  meal with its usage stats, opened from the meal tab.

## [1.0.19] — 2026-06-19

### Added
- **A manual "Install app" row on the Profile page,** for when the
  browser's automatic install prompt never fires. Shows an install button
  when the browser-native prompt is available, otherwise shows platform-
  specific manual instructions.

## [1.0.18] — 2026-06-19

### Changed
- **Meal names typed into the meal planner are now capitalised on save
  too,** matching the treatment item names already got. A meal entered as
  "taco" is stored "Taco." Lookups stay case-insensitive, so existing meal
  names are unaffected.

## [1.0.17] — 2026-06-19

### Changed
- **Item names are now always capitalised,** wherever they're shown across
  the app, so even legacy lowercase entries never display uncapitalised.
  The rest of the name is left as typed, so proper nouns, acronyms and
  casing like "7 Up" are preserved.

## [1.0.16] — 2026-06-19

### Added
- **Gluten-free shorthand:** adding an item like "Pasta GF" now stores it
  as "Pasta" with a "Gluten-free" note instead. The plain item and its
  gluten-free variant coexist as two distinct lines.

## [1.0.15] — 2026-06-19

### Changed
- **Shopping list: the item-count summary now shares a row with the
  list/grid view-toggle buttons** instead of sitting on its own line below
  them.

## [1.0.14] — 2026-06-19

Completes an early round of UX improvements. (Multiple meals per day was
intentionally skipped for now — keeping one meal per day.)

### Added
- **Dark mode**, with a Light / Dark / Follow system control in the
  Profile settings (defaults to following the OS). The theme is applied
  before the page renders to avoid a flash, and the app's status-bar
  colour tracks the effective theme.

## [1.0.13] — 2026-06-19

Continuing the same early round of UX improvements: look & feel. (Dark
mode was deferred to the next release, needing more careful colour work.)

### Changed
- **Darkened a muted text colour** so secondary labels and struck-through
  "bought" text meet accessibility contrast guidelines.
- **The Profile page now shows a plain version number;** the deploy-
  mismatch debugging detail moved to the Admin subpage.

## [1.0.12] — 2026-06-19

Continuing the same early round of UX improvements: recent-list and
meal-planner polish. (Multiple meals per day is deferred — it needs a
database change.)

### Added
- **A "N items left" summary above the shopping list** (and a celebratory
  message when nothing's left).

### Changed
- **"Recently bought" now starts collapsed** (still toggleable, choice
  remembered). It also shows at most the 30 most-recent bought items, so
  the history can't grow unbounded.
- **The meal planner can now look up to 4 weeks ahead** (still 1 week
  back) for planning further out.
- **The add-item field now hints the quantity shorthand** in its
  placeholder text (e.g. "Add item – e.g. «2 milk»").

## [1.0.11] — 2026-06-19

Continuing the same early round of UX improvements: the core meal →
shopping list connection — the app's headline promise, finally wired up.

### Added
- **From the meal modal, a button opens a picker of that meal's
  ingredients.** You choose which to add; ingredients already on the
  active list are shown but left unchecked, the rest are pre-checked. A
  toast confirms how many landed.
- **A note in the meal modal clarifies that ingredients are stored per
  meal name** and shared across every date that meal appears on.

## [1.0.10] — 2026-06-19

Continuing the same early round of UX improvements: shopping list
reliability.

### Added
- **Instant feedback:** checking off and deleting items update the screen
  immediately and reconcile with the server in the background (with
  revert on failure). View/sort/collapse changes now re-render instantly
  too.
- **Undo on delete:** items are removed instantly with a 5-second "Undo"
  toast.
- **Adding an item that's already on the list now shows a toast explaining
  the quantity was increased.**
- **Failed adds/toggles/deletes now surface a toast and keep the typed
  text,** instead of silently appearing to succeed.

### Changed
- **An expired session now explains itself on the login screen** instead
  of silently bouncing to login.

### Fixed
- **Tapping the icon inside a card's edit/delete button no longer also
  toggles the item's bought-state.**

## [1.0.9] — 2026-06-19

Continuing the same early round of UX improvements: quick, low-risk
frontend wins.

### Added
- **Show/hide password toggle on the login screen** and both change-
  password fields.
- **Login button now shows a "Signing in..." state and is disabled while
  the request is in flight,** preventing double-submit.
- **Screen-reader labels added to icon-only buttons.**

### Changed
- **Re-enabled pinch-to-zoom** for accessibility.
- **Pressing Enter in the username or password field now submits the
  login.**
- **Clarified the "delete item from catalogue" confirmation** — it
  removes the item from this list's saved items (no longer suggested) and
  only affects this list.

## [1.0.8] — 2026-06-19

### Fixed
- **The shopping list/meal plan kept refreshing even while the tab wasn't
  visible.** Refreshing now pauses while the tab is hidden and resumes
  with an immediate refresh when you come back to it.

## [1.0.7] — 2026-06-19

### Fixed
- **Long-press to open the item modal in grid view didn't work reliably
  on touch devices,** since touch input reports a few pixels of jitter
  even when held still. Grid view now tolerates a small amount of
  movement before canceling, matching list view's existing behavior.

## [1.0.6] — 2026-06-19

### Added
- **Item modal now allows renaming the catalogue entry itself,** and
  deleting it from the catalogue entirely (removing it everywhere it
  appears).
- **Autocomplete suggestions now include an explicit "add exactly as
  typed" option.** It adds the raw input as-is, bypassing catalogue
  matching and quantity parsing entirely.

### Fixed
- **Autocomplete suggestions dropdown is now dismissed on any click
  outside the add bar,** instead of lingering over other UI.
- **A trailing number in a typed item name is no longer treated as a
  quantity** (e.g. "milk 2" no longer splits into "milk" x2). Only the
  unambiguous leading "quantity, then name" form is parsed that way.

## [1.0.5] — 2026-06-18

### Added
- **Meal plan now has an "Ingredients" field** in the meal-edit modal,
  shared across every occurrence of that meal name. Picking a known meal
  name auto-fills its stored ingredients.

### Fixed
- **A product name containing a number is no longer mis-split into
  name+quantity** if it exactly matches an existing catalogue item.
- **New shopping-list items are stored as typed** instead of being force-
  uppercased, matching the Title Case of the seeded catalogue.
- **Removed a stale duplicate copy of the account-setup page** left over
  from an earlier version.

## [1.0.4] — 2026-06-18

### Fixed
- **Login rate-limiting:** login now tracks failed attempts per source IP
  and returns a "too many attempts" error after 10 failures in a 15-
  minute window. Keyed by IP rather than username so flooding a known
  account's login can't lock out its real owner.
- **Fixed a styling bug** where the change-password button and success/
  error messages had no colour defined.

## [1.0.3] — 2026-06-18

### Changed
- **Profile page: moved a couple of internal/operational figures into the
  admin-only Admin subpage,** since they're not relevant to regular
  members. Removed a non-actionable "syncs every 7 seconds" row.

## [1.0.2] — 2026-06-18

### Changed
- **Meal plan no longer keeps long-term history.** Week navigation is
  clamped to last/this/next week, and old planned days are cleaned up
  automatically after 14 days; saved meal names themselves are untouched.

## [1.0.1] — 2026-06-18

### Fixed
- **Meal-plan date off-by-one:** the week grid, "today," and the saved
  date could silently shift back a day depending on your timezone and
  time of day. Dates are now computed from local date components instead
  of a UTC conversion.

## [1.0.0] — 2026-06-18

First tagged version. Establishes versioning for the already-live app;
captures the feature set shipped to date.

### Added
- **Shared shopping list,** with autocomplete, category grouping, quantity
  + notes, list and grid views, and swipe-to-buy.
- **Meal planner** with a Monday–Sunday week view, any-week navigation,
  and an assigned-responsible person per day.
- **Accounts and auth:** password hashing, secure login tokens with
  sliding expiry, and an in-app password change that logs out other
  devices.
- **Multi-tenant model:** per-list data isolation with independent
  admin/owner flags, admin-created owner lists, and owner-managed
  members.
- **Catalogue seeds:** ~710 common household items, seeded non-
  destructively.
- **PWA install prompt, emoji/SVG item icons,** and a one-time
  credential/invite dialog for newly created accounts.
- **A version readout** on the Profile page.

[1.0.0]: https://github.com/SpaceSphereWheatley/panhandle/releases/tag/v1.0.0

---

## About this file

All notable changes to Panhandle are recorded here, one entry per release.
Each bullet leads with a plain-language summary of what changed and why it
matters, followed by the fuller technical detail for anyone who wants it —
the in-app "What's new" modal and the full changelog page both show only
that lead sentence, so the detail lives here for developer/historical
reference.

The version is duplicated and bumped together on each release:

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
