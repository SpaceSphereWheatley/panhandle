-- category_order (0017_category_order.sql) declared list_id as TEXT with no
-- REFERENCES clause, unlike every other list-scoped table (INTEGER REFERENCES
-- lists(id)). In production this wasn't just cosmetic: binding a JS number
-- against a TEXT-affinity column made SQLite store it as "1.0" (REAL-to-TEXT
-- conversion), not "1" — confirmed by inspecting the live data before writing
-- this migration. It also meant list deletion relied entirely on the app's
-- manual `DELETE FROM category_order WHERE list_id = ?` cleanup, with no FK to
-- catch a missed/failed cleanup. SQLite can't ALTER COLUMN, so rebuild the
-- table, same pattern as 0008/0009's meal_plan rebuilds. category_order has no
-- children referencing it, so — unlike the item_catalogue/meal_catalogue
-- rebuild incident documented in docs/multi-tenant-migration-log.md — this
-- rebuild can't cascade-delete anything else.
CREATE TABLE category_order_new (
  list_id  INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (list_id, category)
);
INSERT INTO category_order_new (list_id, category, position)
  SELECT CAST(list_id AS INTEGER), category, position FROM category_order;
DROP TABLE category_order;
ALTER TABLE category_order_new RENAME TO category_order;
