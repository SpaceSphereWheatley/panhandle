-- Adds a display name, separate from username/e-mail (TODO #17). Existing
-- rows are backfilled from their current username as a starting value —
-- editable afterward in Settings (POST /change-name), and re-seeded from
-- Google's `name` claim on next Google sign-in only if still unset.
ALTER TABLE users ADD COLUMN name TEXT;
UPDATE users SET name = username WHERE name IS NULL;
