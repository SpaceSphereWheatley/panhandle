-- A household can tell the app how often it buys an item ("toilet paper
-- every 14 days") instead of waiting for GET /catalogue/suggestions to learn
-- it from purchase history. NULL = learn it automatically (the default).
-- When set, it replaces the learned interval, makes the item suggestible
-- after a single purchase, and exempts it from the "no longer bought"
-- cut-off.
--
-- Additive only, per the expand/contract rule: nullable, no default, and
-- the deployed code never selects it.
ALTER TABLE item_catalogue ADD COLUMN repeat_every_days INTEGER;
