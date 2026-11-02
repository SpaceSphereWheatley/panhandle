-- One-off repair of item_catalogue's purchase stats. Until 1.69.1 every
-- unbought->bought tick counted as a purchase, so an item ticked, unticked
-- and ticked again — or re-added and bought twice in one evening — piled up
-- times_bought within hours, and GET /catalogue/suggestions divided a tiny
-- first-to-last span by that inflated count ("about every 0 days").
--
-- Purchases now count once per Oslo calendar day (PURCHASE_BUMP_SET in
-- worker/index.js). There's no purchase history to recount from, only
-- first_bought/last_bought, so this caps times_bought at the number of
-- calendar days that span covers — the most distinct purchase days it can
-- hold. An item bought only on one day drops to 1 and stops being suggested
-- until it's bought on another day.
--
-- '+1 hours' approximates Oslo time (CET); it only shifts which side of
-- midnight a purchase made within an hour of it falls on.
--
-- Data-only and idempotent: re-running changes nothing, and the deployed
-- code reads the same columns either way.
UPDATE item_catalogue
SET times_bought = CAST(
      julianday(date(last_bought, '+1 hours')) - julianday(date(first_bought, '+1 hours'))
    AS INTEGER) + 1
WHERE times_bought >= 2
  AND first_bought IS NOT NULL
  AND last_bought IS NOT NULL
  AND times_bought > CAST(
      julianday(date(last_bought, '+1 hours')) - julianday(date(first_bought, '+1 hours'))
    AS INTEGER) + 1;
