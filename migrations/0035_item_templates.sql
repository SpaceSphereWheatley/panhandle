-- Saved lists ("Cabin trip", "Taco night", "Weekly basics"): a named set of
-- items a household can add to the shopping list in one go. Items are a
-- JSON string array of free-typed names, same shape and sanitizing as
-- meal_catalogue.ingredients, so the frontend reuses the meal ingredient
-- picker (buildIngredientRows/addRowsToList) to resolve them against the
-- catalogue at add time — a renamed or deleted catalogue item never breaks
-- a saved list.
--
-- list_id cascades from lists(id) like the newer per-list tables, but both
-- list-deletion paths also clear it explicitly, matching how the rest are
-- handled there. Additive only: a new table the deployed code never reads.
CREATE TABLE IF NOT EXISTS item_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_item_templates_list ON item_templates(list_id);
