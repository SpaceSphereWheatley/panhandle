CREATE TABLE IF NOT EXISTS item_catalogue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  category    TEXT NOT NULL DEFAULT 'Annet',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS list_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  catalogue_id INTEGER NOT NULL REFERENCES item_catalogue(id) ON DELETE CASCADE,
  bought      INTEGER NOT NULL DEFAULT 0,
  added_by    TEXT NOT NULL,
  added_at    TEXT NOT NULL DEFAULT (datetime('now')),
  bought_at   TEXT
);

CREATE TABLE IF NOT EXISTS meal_catalogue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  ingredients TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_plan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date   TEXT NOT NULL UNIQUE,
  meal_id     INTEGER NOT NULL REFERENCES meal_catalogue(id) ON DELETE CASCADE,
  responsible TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_list_bought ON list_items(bought);
CREATE INDEX IF NOT EXISTS idx_plan_date ON meal_plan(plan_date);
