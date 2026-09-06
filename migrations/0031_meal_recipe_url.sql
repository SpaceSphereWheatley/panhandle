-- A meal can carry a link to its recipe online. Stored on
-- meal_catalogue rather than meal_plan so the link follows the meal itself:
-- picking a known meal for a day automatically brings its recipe along,
-- exactly like the ingredients array already does.
--
-- Nullable with no default: NULL / '' both mean "no recipe link". Additive
-- only, per the expand/contract rule — the currently deployed code simply
-- never selects this column.
ALTER TABLE meal_catalogue ADD COLUMN recipe_url TEXT;
