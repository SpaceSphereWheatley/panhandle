-- Per-item "important" flag, toggled directly from the shopping list card (a
-- tappable star badge, mirroring the stale-item clock badge added in 0015).
-- Lives on list_items (not item_catalogue) since importance is about this
-- shopping trip's line, not the general item concept — same scoping as
-- `bought`.
ALTER TABLE list_items ADD COLUMN important INTEGER NOT NULL DEFAULT 0;
