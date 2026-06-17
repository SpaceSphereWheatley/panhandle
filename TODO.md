# TODO

Open items, numbered and sorted by value (highest-value first). Numbers are
stable IDs for reference in commits/discussion — don't renumber when items
are completed or reordered, just strike them from this list and let the
rest keep their numbers (re-pack the list only if it gets sparse).

6. Add a grid view for the shopping list as an alternative to the current
   list view (toggle between the two), with a per-item icon. Until real
   icons exist, render a circular badge with the item's first letter as a
   placeholder icon.
7. Drag-to-reorder or swipe-to-delete on shopping list cards, once the
   item modal (#1) exists (avoid gesture conflicts between
   long-press-for-modal and swipe-to-delete).
8. PWA install prompt / "add to home screen" hint, since `manifest.json`
   exists but there's no onboarding nudge to actually install it.
9. Meal plan: surface `meal_catalogue.ingredients` somewhere in the UI —
   it's stored but currently unused/unedited by the frontend.
10. Build a small icon set for common grocery items (start with whatever
    categories/names show up most in the catalogue).
11. Icon lookup: match by item name (normalized), fall back to
    first-letter badge if no icon exists.
12. Add an admin/settings view listing catalogue items that don't have a
    matching icon yet, to help decide what to design next.
13. Multi-owner lists, admin-created accounts, per-list isolation —
    see docs/multi-tenant-plan.md for full design.

## Done

- [x] Item detail modal: long-press the card or tap "⋮" to edit category,
      quantity, and notes (`PATCH /api/list/:id`).
- [x] Allow editing an item's category from the item modal.
- [x] Empty states for the shopping list ("Ingen varer på listen").
- [x] Basic offline/slow-network handling — `syncStatus` shows
      "Offline"/"Kunne ikke oppdatere" on failed polls, browser
      online/offline events trigger an immediate retry.
- [x] Meal plan UI: Monday–Sunday week view with prev/next/this-week nav.
- [x] Make layout mobile-first but consistent at desktop widths too — cap
      content width (e.g. `max-width: 480px`, centered) instead of a
      separate desktop layout.
- [x] Add a `notes` (free text — quantity, description, etc.) column to
      `list_items`. Migration `0003_list_items_qty_notes.sql`; storage/
      display only — entry UI is item #1 above.
- [x] Quantity-aware "merge" when adding an item that's already on the
      list unbought (previously created duplicate rows against the same
      catalogue entry).
</content>
