-- Contract step for 0027/0028, same shape as 0021 was for 0012/0014/0019.
--
-- Two pieces of the storage module's *original* design are now unreferenced
-- by any code:
--
--  1. lists.next_box_number (0027) — the monotonic never-reused box-number
--     counter. Box numbering was deliberately reversed to "smallest
--     available, reused" (see CLAUDE.md's Storage module section), so
--     POST /storage/boxes allocates via a MIN() query against storage_boxes
--     and nothing reads or writes this column any more.
--
--  2. storage_reserved_numbers (0028) — the server-side "reserve blank
--     numbers to print in advance" table, dropped in favour of purely
--     client-generated print sequences. Nothing has read or written it since;
--     the only remaining references were two DELETE statements in the
--     list-deletion cascades, removed in the same release as this migration.
--
-- ORDER OF APPLICATION — this one is the exception to the usual runbook.
-- Every other migration in this project is expand/contract and is applied
-- slightly *ahead* of the merge, because the additive change is invisible to
-- the still-deployed code. This one is subtractive: the currently-deployed
-- Worker still runs `DELETE FROM storage_reserved_numbers` inside
-- DELETE /account's and DELETE /admin/users/{u}'s last-owner paths, and would
-- throw "no such table" on those paths if the table vanished underneath it.
-- So this migration must be applied **after** the code deploy that removes
-- those two statements has finished, not before. (Verify with GET /api/version
-- against the live Worker first.) That ordering makes the branch preview a
-- poor test surface for this file specifically — it shares the production DB,
-- so it can only be click-tested once the migration has actually been applied
-- post-merge.

DROP TABLE IF EXISTS storage_reserved_numbers;

-- SQLite supports ALTER TABLE ... DROP COLUMN (3.35+, well below D1's
-- version), and next_box_number carries no index, FK or constraint that
-- would block it — so unlike 0021's notification_settings rebuild this needs
-- no table recreation.
ALTER TABLE lists DROP COLUMN next_box_number;
