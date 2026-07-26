-- English-first restructure, part 1 of 2: rewrite the canonical category
-- strings stored in category_order from Norwegian to English, matching the new
-- CATEGORIES array in shared/categories.js.
--
-- Unlike every other migration in this folder, this is a *data* rewrite of
-- values that live code matches on literally, so it is NOT expand/contract and
-- cannot be applied ahead of the merge (see CLAUDE.md's Databases section for
-- why the others can). Apply it immediately before merging: in the ~1 minute
-- before the new Worker/Pages build lands, the still-deployed old code would
-- read these as unknown categories. Nothing is lost — normalizeCategoryOrder
-- rebuilds a complete order from whatever it recognises — and it self-heals the
-- moment the new bundle ships.
--
-- Why it must run at all: normalizeCategoryOrder *drops* names it doesn't
-- recognise, so leaving Norwegian rows in place under the new code would
-- silently reset every household's custom aisle order back to canonical.
--
-- category_order's primary key is (list_id, category). A collision would need a
-- list holding both spellings at once, which can't happen — English was never a
-- valid category value before this migration.
UPDATE category_order SET category = 'Fruit and vegetables'     WHERE category = 'Frukt og grønt';
UPDATE category_order SET category = 'Bread and bakery'         WHERE category = 'Brød og bakevarer';
UPDATE category_order SET category = 'Dairy'                    WHERE category = 'Meieriprodukter';
UPDATE category_order SET category = 'Meat and fish'            WHERE category = 'Kjøtt og fisk';
UPDATE category_order SET category = 'Ingredients and spices'   WHERE category = 'Ingredienser og krydder';
UPDATE category_order SET category = 'Frozen and ready meals'   WHERE category = 'Frysevarer og ferdigmåltid';
UPDATE category_order SET category = 'Grains and pasta'         WHERE category = 'Kornprodukter';
UPDATE category_order SET category = 'Snacks and sweets'        WHERE category = 'Snacks og godteri';
UPDATE category_order SET category = 'Drinks'                   WHERE category = 'Drikkevarer';
UPDATE category_order SET category = 'Household'                WHERE category = 'Husholdning';
UPDATE category_order SET category = 'Health and personal care' WHERE category = 'Omsorg og helse';
UPDATE category_order SET category = 'Pet supplies'             WHERE category = 'Dyreprodukter';
UPDATE category_order SET category = 'Other'                    WHERE category = 'Annet';

-- item_catalogue.category holds the same canonical strings (seeded from
-- COMMON_ITEMS, or chosen in the item editor). Same rewrite, same reasoning —
-- ShoppingListTab groups by these, so a stale Norwegian value would fall
-- through to the "Other" aisle.
UPDATE item_catalogue SET category = 'Fruit and vegetables'     WHERE category = 'Frukt og grønt';
UPDATE item_catalogue SET category = 'Bread and bakery'         WHERE category = 'Brød og bakevarer';
UPDATE item_catalogue SET category = 'Dairy'                    WHERE category = 'Meieriprodukter';
UPDATE item_catalogue SET category = 'Meat and fish'            WHERE category = 'Kjøtt og fisk';
UPDATE item_catalogue SET category = 'Ingredients and spices'   WHERE category = 'Ingredienser og krydder';
UPDATE item_catalogue SET category = 'Frozen and ready meals'   WHERE category = 'Frysevarer og ferdigmåltid';
UPDATE item_catalogue SET category = 'Grains and pasta'         WHERE category = 'Kornprodukter';
UPDATE item_catalogue SET category = 'Snacks and sweets'        WHERE category = 'Snacks og godteri';
UPDATE item_catalogue SET category = 'Drinks'                   WHERE category = 'Drikkevarer';
UPDATE item_catalogue SET category = 'Household'                WHERE category = 'Husholdning';
UPDATE item_catalogue SET category = 'Health and personal care' WHERE category = 'Omsorg og helse';
UPDATE item_catalogue SET category = 'Pet supplies'             WHERE category = 'Dyreprodukter';
UPDATE item_catalogue SET category = 'Other'                    WHERE category = 'Annet';

-- meal_plan.responsible's free-text "Annet" fallback (MealPlanModal's getResp)
-- is a stored person name rather than a category, but it's the same canonical-
-- value flip. Nothing name-matches it, so this is cosmetic consistency: an
-- unmigrated row would keep displaying "Annet" as typed either way.
UPDATE meal_plan SET responsible = 'Other' WHERE responsible = 'Annet';
