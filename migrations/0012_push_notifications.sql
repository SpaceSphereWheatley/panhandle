-- Web Push infrastructure (TODO #7, phase 1): subscribe/unsubscribe plumbing,
-- a per-list "no meal planned for tomorrow" reminder setting, and a dedup log
-- so the cron-driven reminder check never double-sends on a given day.

-- A push subscription is owned by a browser/device, not an account: on a
-- shared household device, whoever last (re)subscribed owns it, so `endpoint`
-- (not `username`) is the primary key. `username` is a by-value copy, not a
-- foreign key (see TODO #17 / renameUsername's doc comment above it in
-- worker/index.js) — kept in sync there and cleaned up alongside list/user
-- deletion and list-membership removal.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  list_id    INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_list ON push_subscriptions(list_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_username ON push_subscriptions(username);

-- Per-list (shared household) reminder config. No row is seeded for existing
-- or newly-created lists — GET /notification-settings returns app-level
-- defaults (enabled, 18:00) when a list has no row yet, and only POST ever
-- creates one, so the column defaults below only take effect once a row
-- exists (matches how AppSettingsIsland's localStorage prefs default in code,
-- not a guaranteed-present DB row).
CREATE TABLE IF NOT EXISTS notification_settings (
  list_id               INTEGER PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE,
  meal_reminder_enabled INTEGER NOT NULL DEFAULT 1,
  meal_reminder_time    TEXT NOT NULL DEFAULT '18:00', -- HH:mm, Europe/Oslo local, 15-min snapped
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dedup guard for the cron-driven reminder check: UNIQUE(list_id, type,
-- target_date) means a second cron tick that resolves to the same local
-- HH:mm (e.g. the repeated hour on an Oslo DST fall-back day) fails its
-- INSERT OR IGNORE and is treated as "already sent," not a second send.
CREATE TABLE IF NOT EXISTS notification_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  target_date TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(list_id, type, target_date)
);
