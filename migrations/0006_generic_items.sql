-- 0006_generic_items.sql
-- Add generic staple items that were missing from the catalogues. The seed
-- (0004) only had specific variants — e.g. Grovbrød/Loff/Knekkebrød but no
-- plain "Brød", many cheeses but no "Ost", Hvetemel/Maizena but no "Mel",
-- Olivenolje/Rapsolje but no "Olje", many cuts/fish but no generic
-- "Kjøtt"/"Fisk". People type the generic word, so it should autocomplete.
--
-- Adds one row per existing list, idempotently: UNIQUE(list_id, name) +
-- INSERT OR IGNORE means re-running is a no-op and existing names are skipped.
-- New lists created after this get the same items via COMMON_ITEMS in
-- worker/index.js. Run manually in the D1 console.

INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Brød',  'Brød og bakevarer',        id FROM lists;
INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Ost',   'Meieriprodukter',          id FROM lists;
INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Mel',   'Ingredienser og krydder',  id FROM lists;
INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Olje',  'Ingredienser og krydder',  id FROM lists;
INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Kjøtt', 'Kjøtt og fisk',            id FROM lists;
INSERT OR IGNORE INTO item_catalogue (name, category, list_id)
  SELECT 'Fisk',  'Kjøtt og fisk',            id FROM lists;
