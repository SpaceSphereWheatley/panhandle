-- Make meal_id nullable so a day can have a responsible person without a meal assigned.
-- SQLite doesn't support ALTER COLUMN, so recreate the table.
CREATE TABLE meal_plan_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date   TEXT NOT NULL,
  meal_id     INTEGER REFERENCES meal_catalogue(id) ON DELETE CASCADE,
  responsible TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, plan_date)
);
INSERT INTO meal_plan_new (id, plan_date, meal_id, responsible, updated_at, list_id)
  SELECT id, plan_date, meal_id, responsible, updated_at, list_id FROM meal_plan;
DROP TABLE meal_plan;
ALTER TABLE meal_plan_new RENAME TO meal_plan;
CREATE INDEX IF NOT EXISTS idx_plan_date ON meal_plan(list_id, plan_date);
