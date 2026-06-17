# TODO

Working list of planned changes. Roughly ordered by dependency, not priority.

## Layout / UI
- [ ] Make layout mobile-first but consistent at desktop widths too — cap content
      width (e.g. `max-width: 480px`, centered) instead of a separate desktop
      layout, so the app looks the same shape on phone and browser.
- [ ] Add a grid view for the shopping list as an alternative to the current
      list view (toggle between the two), with a per-item icon. Until real
      icons exist, render a circular badge with the item's first letter as a
      placeholder icon.
- [ ] Item detail modal: open it by long-pressing the icon/badge, or via a
      "⋮" (three-dot) button on the card. Modal shows/edits: name, category,
      notes (quantity/description), added-by, bought state.

## Data model
- [ ] Add a `notes` (free text — quantity, description, etc.) column to
      `list_items`. Needs migration `0003_item_notes.sql` and worker
      read/write support.
- [ ] Allow editing an item's category from the item modal (updates
      `item_catalogue.category`, since category lives on the catalogue entry,
      not the list row — changing it will affect all list entries sharing
      that catalogue name, which is consistent with "remember category by name").

## Icons
- [ ] Build a small icon set for common grocery items (start with whatever
      categories/names show up most in the catalogue).
- [ ] Add an admin/settings view listing catalogue items that don't have a
      matching icon yet, to help decide what to design next.
- [ ] Icon lookup: match by item name (normalized), fall back to
      first-letter badge if no icon exists.

## Meal plan
- [ ] Switch meal plan view from "next 14 days" to a single Monday–Sunday
      week, with prev/next-week navigation and a "this week" default/reset.

## Other suggestions (not yet confirmed — flag for discussion)
- [ ] Empty states: explicit "no items yet" / "no meals planned this week"
      messaging instead of just an empty container.
- [ ] Quantity-aware "merge" when adding an item that's already on the list
      unbought (currently adding the same name twice creates two rows in
      `list_items` against the same catalogue entry).
- [ ] Drag-to-reorder or swipe-to-delete on shopping list cards, now that
      there's a long-press/three-dot interaction for the modal (avoid
      gesture conflicts between long-press-for-modal and swipe-to-delete).
- [ ] Meal plan: surface `meal_catalogue.ingredients` somewhere in the UI —
      it's stored but currently unused/unedited by the frontend.
- [ ] Basic offline/slow-network handling — `api()` calls fail silently
      (`catch { return; }`) on `/list` and `/plan`, which could show a stale
      list with no indication of failure.
- [ ] PWA install prompt / "add to home screen" hint, since `manifest.json`
      exists but there's no onboarding nudge to actually install it.
