-- Device-only meal-planning reminders: the "no meal planned for tomorrow" and
-- weekly reminders were per-list (shared household) preferences, so one member
-- toggling a reminder off silenced it for everyone. Move that choice to the
-- device: each browser's push subscription now carries its own enabled/time,
-- so members control their own reminders and nobody toggles them for anyone
-- else. (The on-demand "Varsle husstanden" ping stays deliberately
-- household-wide; stale_item_days stays on notification_settings — it's a
-- shopping-list behaviour, not a per-device notification preference.)
--
-- Expand/contract: additive only. The old notification_settings reminder
-- columns are left in place (the deployed code stops reading/writing them, but
-- dropping is a separate later contract step) so existing rows and any
-- in-flight old code stay valid.

-- Per-device reminder config, defaulting to the same values GET
-- /notification-settings used to fall back to (enabled, 18:00) so a device
-- that subscribed before this migration keeps getting reminders.
ALTER TABLE push_subscriptions ADD COLUMN meal_reminder_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE push_subscriptions ADD COLUMN meal_reminder_time TEXT NOT NULL DEFAULT '18:00'; -- HH:mm, Europe/Oslo, 15-min snapped
ALTER TABLE push_subscriptions ADD COLUMN weekly_reminder_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE push_subscriptions ADD COLUMN weekly_reminder_time TEXT NOT NULL DEFAULT '18:00';

-- Per-device dedup guard, replacing notification_log's per-list role for the
-- reminders (notification_log's UNIQUE(list_id, type, target_date) would let
-- only one device per list fire on a given day). Keyed by endpoint so each
-- device fires at most once per type/day; list_id is carried only for
-- ON DELETE CASCADE cleanup when a list is deleted (endpoint is the dedup key).
CREATE TABLE IF NOT EXISTS notification_device_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT NOT NULL,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  target_date TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(endpoint, type, target_date)
);
