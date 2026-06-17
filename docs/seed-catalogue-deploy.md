# Deploy: reset categories + seed 500 catalogue items

Step-by-step to get the new 13-category scheme and the 500-item Norwegian
catalogue (`migrations/0004_seed_catalogue.sql`) live.

> **Order matters.** Deploy the code (new `CATEGORIES`) **before** running the
> seed SQL. The app groups the list by `CATEGORIES`; items whose category isn't
> in that list are hidden. If you seed first, the new items won't show until the
> code is deployed.

---

## Step 1 — Merge the PR into `main`

Merge this branch's PR (`claude/seed-catalogue-no`) into `main` on GitHub.

Cloudflare's Git integration auto-deploys **both** on push to `main`:

- **Worker** (`npx wrangler deploy`) — new `CATEGORIES` validation list in `worker/index.js`.
- **Pages** (`public/`) — new frontend (`public/index.html`) with the 13 categories.

This deploys **code only** — your D1 data is untouched at this point.

## Step 2 — Wait for both deploys to go green

Confirm in the Cloudflare dashboard (or via the Cloudflare bot comment on the
PR) that **both** the Worker build and the Pages build finished successfully
before continuing.

## Step 3 — Run the seed SQL in D1

> ⚠️ **This deletes your current shopping list and catalogue**, then inserts the
> 500 seed items. This is intentional ("start anew").

1. Cloudflare dashboard → **Workers & Pages** → **D1** → database **`panhandle`**.
2. Open the **Console** tab.
3. Open `migrations/0004_seed_catalogue.sql` from the repo and copy its **entire** contents.
4. Paste into the console and **Execute**. It runs, in order:
   - `DELETE FROM list_items;`
   - `DELETE FROM item_catalogue;`
   - `INSERT INTO item_catalogue (name, category) VALUES …` (500 rows)

## Step 4 — Verify the data in D1

Run in the same console:

```sql
SELECT COUNT(*) FROM item_catalogue;                       -- expect 500
SELECT category, COUNT(*) FROM item_catalogue GROUP BY category;
```

The 13 categories should be:
`Frukt og grønt`, `Brød og bakevarer`, `Meieriprodukter`, `Kjøtt og fisk`,
`Ingredienser og krydder`, `Frysevarer og ferdigmåltid`, `Kornprodukter`,
`Snacks og godteri`, `Drikkevarer`, `Husholdning`, `Omsorg og helse`,
`Dyreprodukter`, `Annet`.

## Step 5 — Verify in the live app

1. Open <https://shopping.mohibb.com> and hard-refresh (or reopen the PWA) so the
   new `index.html` loads.
2. Start typing in the add bar — suggestions should now come from the 500-item
   catalogue.
3. Add a few items, toggle **grid view**, and confirm grouping shows the new
   Norwegian categories.

---

## Rollback notes

- **Code:** revert the merge commit on `main`; Cloudflare re-deploys the previous
  Worker + Pages automatically.
- **Data:** git does **not** revert the D1 change. The old list/catalogue is gone
  once Step 3 runs. If you need to undo, you must restore from a D1 backup or
  re-seed manually. Double-check Step 4 before relying on the new data.
