CREATE TABLE IF NOT EXISTS recurring_schedule (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6), -- 0=Mon … 6=Sun
  responsible TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(list_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_recurring_schedule_list ON recurring_schedule(list_id);
