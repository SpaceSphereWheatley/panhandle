-- Durable usage stats on meal_catalogue, used to suggest meals (popular but
-- not eaten recently) and to power the "all saved meals" browse view.
-- meal_plan itself is pruned after 14 days (see worker/index.js's GET /plan
-- cleanup), so these columns live on the never-pruned catalogue row instead.
ALTER TABLE meal_catalogue ADD COLUMN times_planned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE meal_catalogue ADD COLUMN last_planned TEXT;

-- Backfill from whatever meal_plan rows are still live. Older history is
-- already gone by the time this runs, so this is a best-effort seed, not a
-- full reconstruction — counts grow correctly for every plan made from here on.
UPDATE meal_catalogue SET
  times_planned = (SELECT COUNT(*) FROM meal_plan WHERE meal_plan.meal_id = meal_catalogue.id),
  last_planned  = (SELECT MAX(plan_date) FROM meal_plan WHERE meal_plan.meal_id = meal_catalogue.id);
