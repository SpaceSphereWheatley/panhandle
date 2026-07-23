-- Per-list custom aisle order (TODO #105): lets a household reorder the fixed
-- CATEGORIES (shared/categories.js) to match their actual store's layout, a
-- consistently top-ranked shopping-speed feature. One row per (list_id,
-- category) with an explicit position; a list with no rows falls back to the
-- canonical CATEGORIES order (see normalizeCategoryOrder + GET /category-order).
-- Additive/expand-only, like every migration after 0001 — no existing code
-- reads this table, so the currently-deployed Worker ignores it until the new
-- code ships.
CREATE TABLE IF NOT EXISTS category_order (
  list_id TEXT NOT NULL,
  category TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (list_id, category)
);
