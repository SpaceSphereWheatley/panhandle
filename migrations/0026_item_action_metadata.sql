-- Tracks the most recent *edit* (name/category/qty/notes change via the item
-- edit modal) separately from the original add. added_by/added_at already
-- exist and keep their current meaning (including being reset on the
-- re-add-a-bought-item path in POST /list) — these new columns are only
-- populated by PATCH /list/:id, so the item modal can show whichever action
-- (add or edit) happened most recently without disturbing added_by/added_at's
-- existing semantics.
ALTER TABLE list_items ADD COLUMN edited_by TEXT;
ALTER TABLE list_items ADD COLUMN edited_at TEXT;
