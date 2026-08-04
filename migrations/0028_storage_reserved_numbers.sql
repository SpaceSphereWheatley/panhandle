-- Outstanding reserved box numbers (docs/storage-module-plan.md's
-- reserve-and-print flow). POST /storage/boxes/reserve burns counter values
-- so a sheet of blank-numbered stickers can be printed before the boxes
-- exist; until 0028 nothing recorded which numbers those were, so a lost
-- print-out meant the numbers were silently gone — no way to see them, no
-- way to reprint them.
--
-- Deliberately a record of *reservations only*, not "every number without a
-- live box". Those two sets differ in an important way: a number whose box
-- was deleted is also gap in the counter's range, but reissuing it risks
-- colliding with a sticker still stuck on a physical box somewhere, so it
-- must not show up as "free to print". A reserved-and-never-claimed number
-- has no such history. POST /storage/boxes's claim_number still accepts
-- either (scanning an old sticker to deliberately reuse it is a legitimate,
-- explicitly-chosen action) — this table only governs what the UI *offers*.
--
-- Rows are deleted when the number is claimed by a real box, or discarded by
-- hand. Additive/expand-only, like every migration after 0001.
CREATE TABLE IF NOT EXISTS storage_reserved_numbers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id    INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  number     INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(list_id, number)
);
CREATE INDEX IF NOT EXISTS idx_storage_reserved_list ON storage_reserved_numbers(list_id);
