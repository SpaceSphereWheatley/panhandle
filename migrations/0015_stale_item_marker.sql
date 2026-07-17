-- Per-list threshold (days) for the shopping list's "stale item" marker: a
-- purely visual/client-side indicator on unbought items that have sat on the
-- list longer than this, computed from list_items.added_at (already durable,
-- see 0001_init.sql) — no cron, push, or dedup log needed, unlike the actual
-- push-notification reminders this table otherwise holds. Reuses
-- notification_settings anyway since it's the only per-list settings
-- row/endpoint (GET/POST /notification-settings) the app has.
ALTER TABLE notification_settings ADD COLUMN stale_item_days INTEGER NOT NULL DEFAULT 7;
