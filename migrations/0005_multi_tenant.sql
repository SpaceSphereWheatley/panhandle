-- 0005_multi_tenant.sql
-- Multi-tenant migration: per-list isolation + owner/admin flags.
-- This file was originally run by hand in the D1 console during a coordinated
-- cutover (see docs/multi-tenant-setup.md); it is now tracked by Wrangler's D1
-- migrations runner like the rest. The PRAGMA foreign_keys caveats in section 6
-- reflect that hand-run history and the cascade incident in the migration log.
--
-- ORDERING MATTERS — run this AT CUTOVER, i.e. right before/after the new
-- worker/index.js goes live on `main`. The table rebuilds below change
-- UNIQUE(name) -> UNIQUE(list_id, name) and UNIQUE(plan_date) ->
-- UNIQUE(list_id, plan_date); the OLD worker's `ON CONFLICT(name)` /
-- `ON CONFLICT(plan_date)` writes would error once those constraints change.
-- Reads keep working throughout. See docs/multi-tenant-setup.md.
--
-- D1 connections have PRAGMA foreign_keys OFF by default, so the DROP TABLE /
-- RENAME rebuild pattern below is safe even though list_items references
-- item_catalogue and meal_plan references meal_catalogue.

-- D1's query path enforces foreign keys (PRAGMA foreign_keys = ON), so a
-- `DROP TABLE` on a parent performs an implicit DELETE of its rows and fires
-- ON DELETE CASCADE on children. Dropping item_catalogue/meal_catalogue would
-- therefore wipe list_items/meal_plan. The rebuild section (6) MUST run with
-- foreign keys disabled — hence the PRAGMA wrappers below. IMPORTANT: if your
-- runner wraps this whole file in one transaction, `PRAGMA foreign_keys` is a
-- silent no-op inside a transaction; in that case run section 6 on its own (or
-- back up list_items + meal_plan first). The D1 dashboard console honors the
-- PRAGMA when the statement runs outside an explicit transaction.

PRAGMA foreign_keys = OFF;

-- 1. The lists table. No owner_username column: ownership lives on
--    users.is_owner, and a list can have more than one owner.
CREATE TABLE IF NOT EXISTS lists (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. User flags + list membership. is_admin/is_owner are independent 0/1
--    flags (a user can be both). list_id is nullable here and tightened to
--    NOT NULL implicitly by the app only operating on populated rows.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN list_id  INTEGER REFERENCES lists(id);
ALTER TABLE users ADD COLUMN created_by TEXT;

-- 3. list_id on the data tables (nullable for now; backfilled in step 5).
ALTER TABLE item_catalogue ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE list_items     ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE meal_catalogue ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE meal_plan      ADD COLUMN list_id INTEGER REFERENCES lists(id);

-- 4. Create the existing household's list (id 1).
INSERT INTO lists (id) VALUES (1);

-- 5. Backfill. Mohibb = owner + admin, Saffa = plain member; both on list 1.
--    Any other stray pre-existing user also lands on list 1 as a plain member.
UPDATE users SET list_id = 1, is_owner = 1, is_admin = 1 WHERE username = 'Mohibb' COLLATE NOCASE;
UPDATE users SET list_id = 1, is_owner = 0, is_admin = 0 WHERE username = 'Saffa'  COLLATE NOCASE;
UPDATE users SET list_id = 1 WHERE list_id IS NULL;

UPDATE item_catalogue SET list_id = 1 WHERE list_id IS NULL;
UPDATE list_items     SET list_id = 1 WHERE list_id IS NULL;
UPDATE meal_catalogue SET list_id = 1 WHERE list_id IS NULL;
UPDATE meal_plan      SET list_id = 1 WHERE list_id IS NULL;

-- 6. Rebuild the three tables whose UNIQUE constraints must become per-list,
--    plus list_items (to make list_id NOT NULL). Order: parents before the
--    children that FK-reference them, so the new child tables' FK targets
--    exist at CREATE time. (FK enforcement is off, so DROP order is free, but
--    the referenced table name must resolve when the *_new table is created.)

-- 6a. item_catalogue: UNIQUE(name) -> UNIQUE(list_id, name)
CREATE TABLE item_catalogue_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL COLLATE NOCASE,
  category   TEXT NOT NULL DEFAULT 'Annet',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  list_id    INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, name)
);
INSERT INTO item_catalogue_new (id, name, category, created_at, list_id)
  SELECT id, name, category, created_at, list_id FROM item_catalogue;
DROP TABLE item_catalogue;
ALTER TABLE item_catalogue_new RENAME TO item_catalogue;

-- 6b. list_items: add NOT NULL list_id (no UNIQUE change).
CREATE TABLE list_items_new (
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
INSERT INTO list_items_new (id, catalogue_id, bought, added_by, added_at, bought_at, qty, notes, list_id)
  SELECT id, catalogue_id, bought, added_by, added_at, bought_at, qty, notes, list_id FROM list_items;
DROP TABLE list_items;
ALTER TABLE list_items_new RENAME TO list_items;

-- 6c. meal_catalogue: UNIQUE(name) -> UNIQUE(list_id, name)
CREATE TABLE meal_catalogue_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL COLLATE NOCASE,
  ingredients TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, name)
);
INSERT INTO meal_catalogue_new (id, name, ingredients, created_at, list_id)
  SELECT id, name, ingredients, created_at, list_id FROM meal_catalogue;
DROP TABLE meal_catalogue;
ALTER TABLE meal_catalogue_new RENAME TO meal_catalogue;

-- 6d. meal_plan: UNIQUE(plan_date) -> UNIQUE(list_id, plan_date)
CREATE TABLE meal_plan_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_date   TEXT NOT NULL,
  meal_id     INTEGER NOT NULL REFERENCES meal_catalogue(id) ON DELETE CASCADE,
  responsible TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  list_id     INTEGER NOT NULL REFERENCES lists(id),
  UNIQUE(list_id, plan_date)
);
INSERT INTO meal_plan_new (id, plan_date, meal_id, responsible, updated_at, list_id)
  SELECT id, plan_date, meal_id, responsible, updated_at, list_id FROM meal_plan;
DROP TABLE meal_plan;
ALTER TABLE meal_plan_new RENAME TO meal_plan;

-- 7. Recreate indexes (the old ones were dropped with their tables), now
--    list-scoped for the per-list query patterns the worker uses.
CREATE INDEX IF NOT EXISTS idx_list_bought ON list_items(list_id, bought);
CREATE INDEX IF NOT EXISTS idx_plan_date   ON meal_plan(list_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_item_list   ON item_catalogue(list_id);
CREATE INDEX IF NOT EXISTS idx_users_list  ON users(list_id);

PRAGMA foreign_keys = ON;
