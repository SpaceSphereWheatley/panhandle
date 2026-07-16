-- Web Push notifications, phase 2 (TODO #7): a weekly meal-plan reminder and
-- an on-demand "get the other person's attention" ping.

-- Sunday's day-of-week is hardcoded in worker/index.js's checkWeeklyReminders
-- rather than a configurable column here — a low-frequency nudge isn't worth
-- another setting.
ALTER TABLE notification_settings ADD COLUMN weekly_reminder_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notification_settings ADD COLUMN weekly_reminder_time TEXT NOT NULL DEFAULT '18:00';

-- Internal bookkeeping the cron/endpoints maintain (watermarks, cooldowns),
-- kept separate from notification_settings (user-facing preferences) —
-- mirrors notification_log already being internal-only. Currently used only
-- by POST /push/ping's 2-minute per-list cooldown.
CREATE TABLE IF NOT EXISTS notification_state (
  list_id          INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  last_notified_at TEXT NOT NULL,
  PRIMARY KEY (list_id, type)
);
