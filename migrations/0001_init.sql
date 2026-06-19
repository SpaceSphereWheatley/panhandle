-- Consolidated schema (replaces former 0001-0007, squashed here because
-- this project has exactly one deployment, so there's no migration history
-- across environments to preserve — every fresh DB gets the final schema
-- directly). Catalogue data seeding lives separately in
-- 0002_seed_catalogue.sql so this file stays pure schema.

CREATE TABLE IF NOT EXISTS lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY COLLATE NOCASE,
  pass_hash     TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  is_admin      INTEGER NOT NULL DEFAULT 0,
  is_owner      INTEGER NOT NULL DEFAULT 0,
  list_id       INTEGER REFERENCES lists(id),
  created_by    TEXT
);

CREATE TABLE IF NOT EXISTS item_catalogue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE,
  category   TEXT NOT NULL DEFAULT 'Annet',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  list_id    INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, name)
);

CREATE TABLE IF NOT EXISTS list_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  catalogue_id INTEGER NOT NULL REFERENCES item_catalogue(id) ON DELETE CASCADE,
  bought       INTEGER NOT NULL DEFAULT 0,
  added_by     TEXT NOT NULL,
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  bought_at    TEXT,
  qty          INTEGER NOT NULL DEFAULT 1,
  notes        TEXT,
  list_id      INTEGER NOT NULL REFERENCES lists(id)
);

CREATE TABLE IF NOT EXISTS meal_catalogue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL COLLATE NOCASE,
  ingredients TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, name)
);

CREATE TABLE IF NOT EXISTS meal_plan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date   TEXT NOT NULL,
  meal_id     INTEGER NOT NULL REFERENCES meal_catalogue(id) ON DELETE CASCADE,
  responsible TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, plan_date)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_list_bought            ON list_items(list_id, bought);
CREATE INDEX IF NOT EXISTS idx_plan_date              ON meal_plan(list_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_item_list              ON item_catalogue(list_id);
CREATE INDEX IF NOT EXISTS idx_users_list             ON users(list_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip, created_at);
