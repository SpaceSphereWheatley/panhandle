-- Lets a household push a "probably out of" suggestion away for a while
-- (snooze) or stop suggesting an item altogether (mute), without touching
-- its purchase stats. Both live on item_catalogue next to times_bought /
-- first_bought / last_bought, which are what drive GET /catalogue/suggestions.
--
-- suggest_snoozed_until: UTC datetime ('YYYY-MM-DD HH:MM:SS', SQLite's own
-- datetime() format); NULL or a past value means "not snoozed".
-- suggest_muted: 1 = never suggest this item until un-muted.
--
-- Additive only, per the expand/contract rule — the currently deployed code
-- never selects either column, and both are nullable/defaulted so its INSERTs
-- stay valid.
ALTER TABLE item_catalogue ADD COLUMN suggest_snoozed_until TEXT;
ALTER TABLE item_catalogue ADD COLUMN suggest_muted INTEGER NOT NULL DEFAULT 0;
