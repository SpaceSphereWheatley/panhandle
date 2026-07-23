-- Contract step for the expand/contract migrations 0012/0014/0015/0019: the
-- reminder preferences moved to per-device push_subscriptions columns in
-- 0019, leaving notification_settings.meal_reminder_enabled/meal_reminder_time
-- /weekly_reminder_enabled/weekly_reminder_time unread and unwritten by any
-- deployed code (confirmed by grep — worker/index.js only ever selects/writes
-- stale_item_days on this table now). notification_log became dead the same
-- way once notification_device_log (0019) took over per-device dedup; nothing
-- reads or writes it either. Safe to drop now under this project's expand/
-- contract rule ("drop the old column ... only once no deployed code
-- references it") — both have been unused since 0019 shipped.
DROP TABLE notification_log;

-- SQLite can't ALTER COLUMN/DROP multiple columns atomically in one
-- statement here without recreating, so rebuild, same pattern as
-- 0008/0009/0020. notification_settings has no children referencing it, so
-- this can't cascade-delete anything else.
CREATE TABLE notification_settings_new (
  list_id         INTEGER PRIMARY KEY REFERENCES lists(id) ON DELETE CASCADE,
  stale_item_days INTEGER NOT NULL DEFAULT 7,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO notification_settings_new (list_id, stale_item_days, updated_at)
  SELECT list_id, stale_item_days, updated_at FROM notification_settings;
DROP TABLE notification_settings;
ALTER TABLE notification_settings_new RENAME TO notification_settings;
