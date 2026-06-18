# Multi-tenant rollout — step-by-step setup guide

This is the **manual cutover checklist** for shipping the multi-tenant change
(per-list isolation + owner/admin accounts). Everything that could be done in
code is already committed on branch `claude/funny-carson-8da81i`. What remains
are the steps only you can do, because they require the Cloudflare dashboard
and a push to `main` (which is what actually deploys via Cloudflare's Git
integration).

Read the whole thing once before starting — **ordering matters**.

> **Status update:** Steps 1–2 (backup + migration) have already been run
> against the live `panhandle` D1 database via the Cloudflare connection — the
> schema is migrated and all data is intact (a `foreign_keys`-cascade hiccup
> during the rebuild was caught and the affected rows restored from backup; see
> `multi-tenant-migration-log.md`). The only remaining step is **Step 3 (merge
> to `main` to deploy the code)**, after which run the Step 4–5 smoke tests.
> Until the code is deployed, the live (old) Worker's *writes* fail against the
> new schema — reads still work — so deploy promptly.

---

## What's already done (in the branch)

- `migrations/0005_multi_tenant.sql` — the schema migration (numbered `0005`
  because `0004_seed_catalogue.sql` already exists; the plan said `0004`).
- `worker/index.js` — every list/meal/catalogue query is now scoped by
  `list_id`; new admin + owner endpoints; `COMMON_ITEMS` seed; password
  generator.
- `public/index.html` — dynamic member list (no more hardcoded `PEOPLE`),
  owner "Brukere på listen" panel, admin "Alle brukere" panel, copy-invite
  dialog.

## The ordering problem (why this is a coordinated cutover)

The migration changes `UNIQUE(name)` → `UNIQUE(list_id, name)` and
`UNIQUE(plan_date)` → `UNIQUE(list_id, plan_date)`.

- The **old** (currently live) Worker uses `ON CONFLICT(name)` / `ON
  CONFLICT(plan_date)` — these break *after* the migration.
- The **new** Worker uses `ON CONFLICT(list_id, name)` and reads `list_id`
  columns — these break *before* the migration.

So there is no ordering that is perfectly seamless. The least-disruptive path
is: **run the migration, then merge to `main` immediately after.** During the
short gap, reads keep working; only *writes* (adding an item/meal) can fail,
and it's a 2-person app, so the window is seconds. Do not leave a long gap.

---

## Step 1 — Back up the database (30 seconds, do not skip)

In the Cloudflare dashboard: **Workers & Pages → D1 → `panhandle` → … →
Export** (or run an export query). The migration rebuilds four tables with
`DROP TABLE`; an export is your rollback.

Current state at time of writing (for sanity-checking after): 2 users
(`Mohibb`, `Saffa`), 501 catalogue items, 6 list items, 2 meals, 1 plan.

## Step 2 — Run the migration

Open **D1 → `panhandle` → Console** and paste the entire contents of
`migrations/0005_multi_tenant.sql`, then run it.

> If you'd rather I run it for you via the Cloudflare connection, just say so
> at cutover and I'll execute `0005_multi_tenant.sql` against the `panhandle`
> database — but only at the moment you're ready to merge, for the ordering
> reason above.

After it runs, verify:

```sql
SELECT username, is_admin, is_owner, list_id FROM users;
-- expect: Mohibb -> 1,1,1   Saffa -> 0,0,1
SELECT COUNT(*) FROM item_catalogue WHERE list_id = 1;  -- expect 501
SELECT COUNT(*) FROM lists;                              -- expect 1
```

## Step 3 — Deploy code (merge to `main`)

Merge `claude/funny-carson-8da81i` into `main` (open a PR or fast-forward —
your call). Pushing to `main` triggers Cloudflare to redeploy **both** the
Worker (`npx wrangler deploy`) and Pages automatically. Do this right after
Step 2.

There are no new secrets and no `wrangler.toml` changes, so nothing else to
configure in the dashboard.

## Step 4 — Smoke test (as the existing users)

1. Log in as **Mohibb**. The shopping list and meal plan should look exactly
   as before (now silently scoped to `list_id = 1`).
2. Open **Profil** (settings). Because Mohibb is owner+admin you should now
   see two new panels: **Brukere på listen** (owner) and **Admin · opprett
   eier / Alle brukere** (admin).
3. Log in as **Saffa** → should see the same list, but **no** management
   panels (plain member).

## Step 5 — Try the new flows

- **Admin → create an owner:** Profil → "Opprett eier", type a username →
  a dialog shows the generated password once with a **Kopier invitasjon**
  button. Log in as that owner in a private window → their list is empty of
  *your* items but pre-seeded with the ~110 `COMMON_ITEMS`. Confirms isolation.
- **Owner → add a member:** as the new owner, Profil → "Legg til bruker" →
  copy invite → log in as the member → they share the owner's list and appear
  in the meal-responsible dropdown.
- **Admin flag toggles / reset password:** in "Alle brukere", flip Admin/Eier
  checkboxes or hit "Nullstill pw" — each shows the new password once.

## Step 6 — (Later) brand-new deployments only

The `/seed` endpoint still bootstraps a fresh install: the **first** new
account becomes admin+owner of a freshly seeded list; extra accounts in the
same call join it as members. Existing users only get a password reset, so
re-running seed never clobbers a live setup. For *this* migration you don't
need `/seed` at all — your accounts already exist and Step 2 migrates them.

---

## Rollback

If something looks wrong before you merge: you haven't deployed code yet, so
just restore the D1 export from Step 1 (the old Worker keeps working against
the old schema). If you've already merged and need to revert, revert the merge
commit on `main` (redeploys the old Worker) **and** restore the D1 export —
the old Worker can't talk to the migrated schema.

## Verification checklist (from the plan)

- [ ] Existing list/plan data still visible to Mohibb & Saffa (regression).
- [ ] New owner's list is empty of the original household's items.
- [ ] Member of list A cannot see/mutate list B (scoping is server-side via
      `user.list_id`, never client input).
- [ ] Removed member's old token → 401 on next request (re-login prompt).
- [ ] `POST /list-users` with a forged `{"is_admin":true}` body is ignored;
      created user has both flags 0.
- [ ] Flag endpoint refuses to demote the last admin / remove a list's only
      owner.
- [ ] `POST /list-users` rejects the 11th user ("Listen er full").
- [ ] A new list created via `POST /admin/owners` has the `COMMON_ITEMS`.
- [ ] Granting `is_owner` to a second user on a list gives them the owner
      panel (multi-owner works).
