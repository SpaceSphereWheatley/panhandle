-- meal_plan.meal_id was ON DELETE CASCADE, so deleting a meal from
-- meal_catalogue (DELETE /meals/:id in worker/index.js) deleted the whole
-- meal_plan row — including plan_date/responsible — instead of just
-- unassigning the meal. That defeated the point of 0008_meal_plan_nullable_meal.sql
-- (making meal_id nullable specifically so a day can keep a responsible
-- person with no meal assigned). Recreate with ON DELETE SET NULL so
-- deleting a meal actually "reverts the day to unplanned" as intended,
-- instead of destroying the row. SQLite doesn't support ALTER COLUMN, so
-- recreate the table, same as 0008.
CREATE TABLE meal_plan_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date   TEXT NOT NULL,
  meal_id     INTEGER REFERENCES meal_catalogue(id) ON DELETE SET NULL,
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
