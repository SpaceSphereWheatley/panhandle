# Multi-tenant migration — execution log

Companion to `docs/multi-tenant-plan.md` (the design) and
`docs/multi-tenant-setup.md` (the manual cutover steps). This log records
**what was actually built**, the decisions taken autonomously where the plan
left a choice open, and what was deliberately *not* done (and why).

Branch: `claude/funny-carson-8da81i`.

## Plan, then execution

I read the full design in `docs/multi-tenant-plan.md`, the current
`worker/index.js`, `public/index.html`, all four migrations, and the live D1
schema/state before writing anything. The plan was sound and self-consistent;
the only real conflict with reality was the migration filename (see D1 below).
I then implemented the schema, worker, and frontend exactly along the plan's
lines, and wrote the two companion docs.

## Decisions made autonomously (plan left these open / reality differed)

1. **Migration filename `0005`, not `0004`.** The plan repeatedly calls it
   `0004_multi_tenant.sql`, but `0004_seed_catalogue.sql` already exists in
   `migrations/`. Using `0004` would collide and be ambiguous about run order,
   so the file is `migrations/0005_multi_tenant.sql`.

2. **Did NOT run the migration on production.** I have D1 access via the
   Cloudflare connection and could run SQL, but running this migration before
   the new Worker is live would break the *current* Worker's
   `ON CONFLICT(name)`/`ON CONFLICT(plan_date)` writes, and running the new
   Worker before the migration would break it the other way (missing `list_id`
   columns). There is no seamless ordering, and the deploy itself
   (push → `main` → Cloudflare Git integration) is yours to trigger. So the
   migration is a coordinated cutover step in `multi-tenant-setup.md`, to be
   run by you (or by me on request, at the exact moment you merge). This is the
   "manual step" boundary you asked me to stop at. I did run **read-only**
   queries against prod to ground the plan.

3. **Password generator: 12-char grouped, unambiguous charset.** The plan
   offered either a word-passphrase or a random-char string. I chose
   `xxxx-xxxx-xxxx` from a charset with `0/O/1/l/I` removed (rejection-sampled
   to avoid modulo bias). Rationale: there is still no login rate-limiting
   (TODO #14), so I favored entropy (~31^12) over memorability, while the
   grouping keeps it readable when relayed over a screenshot/message.

4. **`GET /list-users` is readable by any authenticated member**, not just
   owners. The plan lists it under "owner endpoints", but the frontend needs
   it on every member's device to populate the meal-responsible dropdown
   (it replaces the old hardcoded `PEOPLE`). `POST`/`DELETE /list-users`
   remain owner-only. Scoping is still strict — it only ever returns the
   caller's own `list_id`.

5. **Member deletion relies on the missing-row 401, not a `token_version`
   bump.** The plan says bump `token_version` on removal; but deleting the
   user row makes `requireAuth`'s DB lookup return no row, which already
   yields a 401 → re-login on the very next request. Same observable result,
   one fewer write. (Flag changes and password resets *do* bump
   `token_version`, since those rows persist.)

6. **`/seed` enhanced for fresh bootstraps.** Old `/seed` created flat global
   users. It now: first new account → admin+owner of a freshly created,
   `COMMON_ITEMS`-seeded list; further new accounts → members of that list;
   existing accounts → password reset only (flags/`list_id` preserved, so
   re-running it never clobbers a migrated prod). Not needed for *this*
   migration (your accounts already exist), but keeps a from-scratch deploy
   working.

7. **Invite text is Norwegian**, matching the rest of the UI, rather than the
   English example string in the plan (the plan flagged it as "e.g.").

8. **`COMMON_ITEMS` ≈ 111 items**, curated from the existing 500-item
   `0004_seed_catalogue.sql` across all `CATEGORIES` buckets (the plan said
   "~100"). `CATEGORIES` itself is unchanged in both worker and frontend.

## What changed, file by file

- **`migrations/0005_multi_tenant.sql`** (new) — `lists` table; `is_admin`,
  `is_owner`, `list_id`, `created_by` on `users`; `list_id` on the four data
  tables; backfill to list 1 (Mohibb = owner+admin, Saffa = member); rebuild
  of `item_catalogue`/`meal_catalogue`/`meal_plan` for compound `UNIQUE`s and
  `list_items` for `NOT NULL list_id`; list-scoped indexes.

- **`worker/index.js`** —
  - `COMMON_ITEMS`, `genPassword()`, `cleanUsername()` added.
  - JWT now carries `list_id`/`is_admin`/`is_owner`; `mintToken(userRow, env)`;
    `requireAuth` returns the live flags+`list_id` row (DB is source of truth).
  - `/login` returns `is_admin`/`is_owner`/`list_id`.
  - Every `/list`, `/catalogue`, `/meals`, `/plan` query scoped by
    `user.list_id` (reads filtered, writes carry it, ownership re-checked on
    PATCH/DELETE/toggle).
  - New: `POST /admin/owners`, `GET /admin/users`,
    `POST /admin/users/{u}/reset-password`, `PATCH /admin/users/{u}/flags`
    (with last-admin and last-owner guards); `GET/POST /list-users`,
    `DELETE /list-users/{u}` (10-user cap, server-forced `0` flags on member
    creation).

- **`public/index.html`** — `PEOPLE` → `people()` from cached `listUsers`;
  login stores flags; owner "Brukere på listen" panel (member list, 10-cap
  counter, add/remove); admin "Alle brukere" panel (create owner, per-row
  flag checkboxes, reset password); one-time credential dialog with "Kopier
  invitasjon"; meal-responsible dropdown uses `people()`.

- **Docs** — `multi-tenant-setup.md` (cutover checklist), this log; `README`,
  `CLAUDE.md`, `TODO.md` updated.

## Validation performed here

- `node --check worker/index.js` → OK.
- Inline frontend `<script>` compiled via `vm.compileFunction` → OK.
- Read-only D1 queries confirmed the pre-migration state quoted above.
- Not run: the migration itself, and any end-to-end test against a deployed
  Worker (no deploy happens until you merge to `main`). The verification
  checklist lives in `multi-tenant-setup.md`.

## Production execution (cutover)

Executed against the live `panhandle` D1 database via the Cloudflare connection.

1. **Backup** — captured a full in-session snapshot of every table (users incl.
   hashes, 501 catalogue rows, 6 list_items, 2 meals, 1 plan) before touching
   anything.
2. **Phase A (additive)** — `lists` table, new columns, backfill to list 1
   (Mohibb owner+admin, Saffa member). Verified: 0 nulls, all data on list 1.
3. **Phase B (rebuilds)** — the four table rebuilds for the compound UNIQUE
   constraints. **Incident:** D1's query path runs with
   `PRAGMA foreign_keys = ON` (my migration had assumed OFF, the SQLite CLI
   default). `DROP TABLE item_catalogue` / `meal_catalogue` therefore performed
   an implicit row DELETE that cascaded (`ON DELETE CASCADE`) and wiped
   `list_items` (6 rows) and `meal_plan` (1 row). The parent tables and their
   data were fine; only the two children were emptied.
4. **Recovery** — re-inserted the 6 `list_items` and 1 `meal_plan` rows from
   the Step 1 backup (referenced catalogue/meal ids and `list_id` all still
   existed, so the FK-on inserts succeeded). Re-verified: 501 / 6 / 2 / 1, all
   on list 1, matching the pre-migration snapshot exactly. No data lost.
5. **Migration file hardened** — added `PRAGMA foreign_keys = OFF/ON` wrappers
   and a warning comment to `0005_multi_tenant.sql` so a re-run on a *populated*
   DB won't repeat the cascade. (Fresh deploys are unaffected: `list_items`/
   `meal_plan` are empty at that point, so there's nothing to cascade.)

Net: production schema is fully migrated and all original data is intact. What
remained after this was deploying the code (merge to `main`).

## Known sharp edges / follow-ups

- An admin resetting *their own* password (or toggling their own flags)
  bumps their own `token_version`, so the sliding-expiry header minted earlier
  in that same response is already stale → they'll re-login on the next call.
  Acceptable, same spirit as `/change-password`.
- The cutover write-failure window (see setup guide §"ordering problem").
- Login rate-limiting (TODO #14) is still open and matters more now that more
  accounts exist; worth doing next.
- `POST /admin/owners` creates the `lists` row outside the seed batch; a failed
  batch could leave one empty orphan `lists` row (harmless).
