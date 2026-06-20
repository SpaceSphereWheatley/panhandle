-- Durable purchase stats on item_catalogue, used to recommend items that are
-- probably running low (see GET /catalogue/suggestions in worker/index.js).
-- list_items cycles bought/unbought and loses bought_at on undo, so these
-- counters live on the never-pruned catalogue row instead — same approach as
-- meal_catalogue's times_planned/last_planned (0004_meal_usage_stats.sql).
ALTER TABLE item_catalogue ADD COLUMN times_bought INTEGER NOT NULL DEFAULT 0;
ALTER TABLE item_catalogue ADD COLUMN first_bought TEXT;
ALTER TABLE item_catalogue ADD COLUMN last_bought TEXT;
