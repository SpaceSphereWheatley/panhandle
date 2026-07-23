-- Tracks whether every existing list's item_catalogue has been backfilled
-- with the current COMMON_ITEMS set (worker/index.js). Single row (id=1).
-- checkCatalogueSync (cron-driven, see worker/index.js's scheduled()) hashes
-- COMMON_ITEMS on every 15-minute tick and compares it against items_hash
-- here; only on a mismatch (i.e. COMMON_ITEMS was actually edited and
-- deployed) does it re-run the CROSS-JOIN-style backfill across every list
-- and update this row. Replaces the old process of hand-writing a one-off
-- migrations/00NN_*.sql (see 0002/0003) every time a common item was added.
CREATE TABLE IF NOT EXISTS catalogue_sync_state (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  items_hash TEXT NOT NULL,
  synced_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
