-- Storage module (docs/storage-module-plan.md): household-shared boxes with
-- a location and a content list, identified by a per-list, human-facing,
-- never-reused number printed on a physical sticker.
--
-- next_box_number is a monotonic per-list counter, not MAX(number)+1 —
-- deleting the highest-numbered box must not let a later box reclaim its
-- number, since a sticker on a box in the garage outlives the DB row.
-- Allocated via `UPDATE lists SET next_box_number = next_box_number + 1
-- WHERE id = ?1 RETURNING next_box_number - 1`, atomic under D1's
-- single-writer SQLite. DEFAULT 1 is correct for every existing row since no
-- boxes exist anywhere yet (there is no backend before this migration).
ALTER TABLE lists ADD COLUMN next_box_number INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS storage_boxes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  location    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  edited_by   TEXT,
  edited_at   TEXT,
  UNIQUE(list_id, number)
);

-- Items replace wholesale on PATCH (the doc: "the list is small; diffing
-- isn't worth it"), so no unique constraint on (box_id, name) — a box can
-- legitimately list the same name twice (two decks of cards).
CREATE TABLE IF NOT EXISTS storage_box_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  box_id   INTEGER NOT NULL REFERENCES storage_boxes(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_storage_box_items_box ON storage_box_items(box_id);
