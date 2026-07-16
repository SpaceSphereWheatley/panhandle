# Multi-tenant Panhandle: owners, members, admin-created accounts

> **Historical.** This is the original design doc for the multi-tenant rollout,
> written against the pre-cutover codebase (hardcoded two-user global tables,
> `public/index.html` as the app itself). It has already shipped — the schema
> it describes (`migrations/0004_multi_tenant.sql`) was later squashed into
> `migrations/0001_init.sql`, and the frontend was rewritten to Vite + React
> (`src/`). Kept only as a record of the original design reasoning; for
> current architecture, see `CLAUDE.md`.

## Context

Panhandle currently hardcodes exactly two users ("Mohibb", "Saffa") sharing one global shopping list and one global meal plan. There is no `list_id` anywhere in the schema — `list_items`, `meal_plan`, `item_catalogue`, and `meal_catalogue` are all unscoped, global tables, and every worker query (`GET /list`, `POST /list`, `GET /plan`, `POST /plan`, etc.) returns/affects all rows with no `WHERE` filtering by user (confirmed via full read of `worker/index.js`, `public/index.html`, and `migrations/0001_init.sql` / `0002_users.sql`).

The goal is to let this become a multi-household product: an admin (you) creates "owner" accounts; each owner gets their own isolated shopping list + meal plan; owners create "member" accounts that share access to *their* list only; no cross-list visibility is possible.

## Data model design

**Roles are flags, not a single enum** — a user can hold any combination of `is_admin` and `is_owner` simultaneously (e.g. your own account is both). "Member" isn't a stored flag, it's just the absence of the other two — every user (admin, owner, or plain member) belongs to exactly one `list_id`, and zero or more of `is_admin`/`is_owner` are set on top of that. Because ownership is a flag rather than a single `owner_username` column on `lists`, **a list can have more than one owner**: any number of users sharing the same `list_id` can have `is_owner=1`, and an admin can grant/revoke that flag on any user via `PATCH /admin/users/{username}/flags`.

No many-to-many membership table is needed because every user still belongs to exactly one list — a simple `list_id` foreign key on `users` is sufficient and keeps queries trivial (`WHERE list_id = ?`).

`migrations/0004_multi_tenant.sql`:
```sql
CREATE TABLE IF NOT EXISTS lists (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
-- no owner_username column: ownership lives on users.is_owner, and since a list can have
-- multiple owners, there's no single column that could hold "the" owner anyway.

ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0; -- 0/1 flags, independent
ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0; -- of each other
ALTER TABLE users ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE users ADD COLUMN created_by TEXT;

-- list_id is added nullable (no DEFAULT 0 — there is no list with id 0, so a NOT NULL
-- DEFAULT 0 would either violate the FK or silently create a fake "list zero"). Backfill
-- first, then tighten to NOT NULL only once every row has a real list_id.
ALTER TABLE item_catalogue ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE list_items     ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE meal_catalogue ADD COLUMN list_id INTEGER REFERENCES lists(id);
ALTER TABLE meal_plan      ADD COLUMN list_id INTEGER REFERENCES lists(id);

-- item_catalogue/meal_catalogue currently have UNIQUE(name COLLATE NOCASE) globally —
-- once per-list, two different households must each be able to have their own "Milk",
-- so this has to become UNIQUE(list_id, name). meal_plan's UNIQUE(plan_date) similarly
-- must become UNIQUE(list_id, plan_date). SQLite/D1 has no ALTER ... DROP/ADD CONSTRAINT,
-- so both require the standard rebuild pattern for each of the 3 affected tables:
--   1. CREATE TABLE <name>_new (... same columns ..., UNIQUE(list_id, name|plan_date));
--   2. INSERT INTO <name>_new SELECT * FROM <name>;
--   3. DROP TABLE <name>;
--   4. ALTER TABLE <name>_new RENAME TO <name>;
-- Do this only AFTER the backfill step below has populated list_id on every row, since
-- the rebuilt table's UNIQUE index needs real list_id values to not collide.
```
Catalogues (`item_catalogue`, `meal_catalogue`) become **per-list**, not shared globally — this is what "a user can't see anything about other lists" requires. To avoid every new household starting from a completely blank catalogue, **seed each new list with a standard set of ~100 common Norwegian grocery items** (matching the existing Norwegian-language UI/categories seen in `CATEGORIES`) at list-creation time:
- Add a hardcoded `COMMON_ITEMS` array to `worker/index.js` — `[{name: "Melk", category: "Meieri"}, {name: "Brød", category: "Brød og bakevarer"}, ...]`, roughly 100 entries spread across the existing `CATEGORIES` buckets (milk, bread, eggs, common vegetables/fruit, common meats, pasta/rice, coffee, etc.).
- Whenever a new list is created (`POST /admin/owners`), bulk-insert all `COMMON_ITEMS` into that list's `item_catalogue` in the same transaction as creating the owner. Households still type their own item names when adding to the shopping list — they just get autocomplete/category-matching for ~100 common items for free instead of starting from zero, without giving up isolation (each list's copy is independent and editable).
- This is a one-time seed at creation, not a synced shared table — if you tweak `COMMON_ITEMS` later, existing lists don't retroactively change, only newly created ones do.

Backfill, in this order: (1) create one `lists` row and note its id, (2) set Mohibb's `is_owner=1, is_admin=1, list_id=<that id>` and Saffa's `list_id=<same id>` (no flags — plain member), (3) `UPDATE` all existing `list_items`/`item_catalogue`/`meal_plan`/`meal_catalogue` rows to that same `list_id`, (4) only then run the table-rebuild step above to add the compound UNIQUE constraints. This preserves current data with zero downtime, and avoids ever having a row with a null/zero `list_id` once the migration completes.

## Worker changes (`worker/index.js`)

- **JWT payload** gains `list_id`, `is_admin`, `is_owner` (`signJwt({ sub, tv, list_id, is_admin, is_owner, exp })`). `requireAuth` already does a DB lookup per request and re-checks `token_version` against the DB row, so it can just return the live `{username, token_version, is_admin, is_owner, list_id}` from that row rather than trusting the JWT's copy — the JWT fields are only a hint for client display, the DB row is the source of truth on every request. This matters because tokens live for 90 days: **any mutation to a user's flags or `list_id` (promotion, demotion, removal from a list) must bump that user's `token_version`** the same way `/change-password` already does.
  - **What this means in practice if it happens**: it is *not* a mid-session kick — nothing forcibly logs anyone out instantly, since the frontend only finds out on its next API call. The next time that user's browser polls `/list` or `/plan` (within 7 seconds, given the existing poll interval) it gets a `401`, and the existing frontend auth-failure handling (clearing the stored token and showing the login screen) kicks in — so functionally: **they're asked to log in again**, not abruptly disconnected mid-action. If they were *removed* from a list, logging in again will fail too (no valid credentials/account); if just demoted, logging back in works and they simply see their new, reduced permissions.
- **Every existing list/plan/catalogue query** gets `WHERE list_id = ?1` (or `AND li.list_id = ?` in the joins) bound to `user.list_id`. This is a mechanical change across `/list`, `/catalogue`, `/plan`, `/meals` handlers — same pattern repeated, not a redesign.
- **`/seed`**: keep as-is for bootstrapping the very first admin account only (still secret-gated). Stop using it for ordinary account creation.
- **New admin endpoints** (require `is_admin = 1`):
  - `POST /admin/owners` — body `{username}`. Generates a random short password (see below), creates a new `lists` row, seeds it with `COMMON_ITEMS` (see Data model design), inserts the user with `is_owner=1`, `list_id=<new list>`, `created_by=admin`. Returns `{username, password}` once (password is never recoverable after this).
  - `GET /admin/users` — returns **every** user in the system (all owners and all members, across all lists), each with their `username`, `is_admin`, `is_owner`, `list_id`, and `created_by`. This is the "admin sees everyone with their respective flags" view — a flat table, not just the admin's own list.
  - `POST /admin/users/{username}/reset-password` — generates a new random password (same generator as account creation), overwrites `pass_hash`, and bumps `token_version` (so any existing session for that user is invalidated, per the note above). Returns `{username, password}` once, for the admin to relay via the same copy-invite-text pattern. This is the recovery path for "owner/member lost access to their account."
  - `PATCH /admin/users/{username}/flags` — body `{is_admin?, is_owner?}`, sets either flag independently (so e.g. granting a second person `is_owner=1` on the same `list_id` makes that list multi-owner, with no separate endpoint needed). **Demoting the last remaining `is_admin=1` user must be rejected** (count admins, refuse if this change would bring it to zero). Every successful flag change bumps the target's `token_version`.
- **New owner endpoints** (require `is_owner = 1`):
  - `POST /list-users` — body `{username}`. Generates a random password, inserts a plain member row (`is_admin=0, is_owner=0` — **never taken from the request body**, so an owner can't pass `is_admin: true` and self-escalate), `list_id=owner.list_id`, `created_by=owner`. **Capped at 10 users per list, owner included** — count existing rows with that `list_id` first and reject with a clear error (e.g. "list is full") once the count is 10.
  - `GET /list-users` — members of the caller's own list (replaces hardcoded `PEOPLE` on the frontend); also used to show the current member count against the 10-user cap in the UI.
  - `DELETE /list-users/{username}` — remove a member; reject if target has `is_owner=1` and is the only owner of that `list_id` (would orphan it) or is not in the same `list_id`. Bumps the removed user's `token_version`.
- **Password generation**: short random passphrase via `crypto.getRandomValues`, no new dependency — e.g. 3 random words from a small (~100-word) hardcoded list joined with a digit, or simpler: 8 random characters from a charset with visually ambiguous characters removed (no `0/O`, `1/l/I`) since these are read off a screen and retyped by hand. Keep it consistent with the project's "no external deps" rule.
- **Authorization note**: the same server-side-only flag-assignment rule applies everywhere — `is_admin`/`is_owner`/`list_id` must never be accepted as request input on user-creation or self-service endpoints, only derived from the authenticated caller's own DB row plus hardcoded constants, with explicit flag changes only possible through the dedicated `PATCH /admin/users/{username}/flags` endpoint.

## Frontend changes (`public/index.html`)

- Replace hardcoded `const PEOPLE = ["Mohibb", "Saffa"]` with a fetch to `GET /list-users` on load, cached in memory, used to populate the meal-responsible `<select>`.
- Add a small "Manage users" panel (visible when `is_owner` is true, from the login response): list current members with their member count vs. the 10-user cap, a "+ Add user" form that calls `POST /list-users` (disabled once the list is full), and a remove button per member calling `DELETE /list-users/{username}`.
- On successful add, show the generated `{username, password}` once in a dialog with a **"Copy invite text"** button — clipboard write of a templated string, e.g.:
  ```
  You've been added to Panhandle! Log in at https://shopping.mohibb.com
  Username: <username>
  Password: <password>
  (Change your password after logging in.)
  ```
- A minimal separate admin view (gated on `is_admin === true`) for creating owners via `POST /admin/owners`, with the same copy-invite-text pattern. It also calls `GET /admin/users` to render a flat table of every user in the system — username, `is_admin`/`is_owner` flags (independent checkboxes, not a single dropdown, since both can be true at once), which `list_id` they belong to — with inline toggles per row to flip either flag (calls `PATCH /admin/users/{username}/flags`), so granting a second owner on a list or promoting/demoting an admin doesn't require manual SQL, plus a **"Reset password"** button per row (calls `POST /admin/users/{username}/reset-password`) that shows the freshly generated password once via the same copy-invite-text dialog.
- `CATEGORIES` duplication and the rest of the app logic (toggle/buy/clear bought, meal planning) are unaffected — they already operate against `/list` and `/plan`, which become list-scoped server-side without any frontend change needed there.

## Migration/rollout sequence

1. Run `0004_multi_tenant.sql` in the D1 console (backfills existing data as one list owned by Mohibb, Saffa as member).
2. Deploy updated `worker/index.js` (list-scoped queries + new admin/owner endpoints) — push to `main`.
3. Deploy updated `public/index.html` (dynamic PEOPLE, user-management UI) — push to `main`.
4. This is now folded directly into the backfill step in migration `0004_multi_tenant.sql` above: Mohibb is set to `is_owner=1, is_admin=1` (both flags, exactly the "owner + admin" combination decided on), Saffa stays a plain member of the same `list_id`. No separate one-off SQL step needed — flags being independent columns means there's no "superset role" special-casing required in route guards; `is_admin` and `is_owner` are just checked independently wherever relevant.

## Verification

- After deploying, log in as the existing owner/member accounts and confirm `/list` and `/plan` still show the existing (now list-scoped) data — regression check.
- As admin, create a test owner via `POST /admin/owners`, log in as that owner, confirm their list is empty (no cross-visibility into the original list).
- As that owner, create a member via `POST /list-users`, log in as the member, confirm they see the owner's list and can add/buy items, and that the meal-responsible dropdown shows only that list's members.
- Confirm a member of list A cannot query/mutate list B's data even with a valid token (e.g. by hand-crafting a request) — list scoping is enforced server-side via `user.list_id`, not client input, so this should hold by construction; worth a manual spot-check.
- Confirm a removed member's pre-existing token is rejected on the very next request after `DELETE /list-users/{username}` (token_version bump took effect) — verify it surfaces as a 401 → re-login prompt on the frontend, not a hang or silent failure.
- Confirm `POST /list-users` with a forged `{"is_admin": true}` in the body is ignored/rejected and the created user still ends up with both flags `0`.
- Confirm `PATCH /admin/users/{username}/flags` refuses to demote the only remaining `is_admin=1` user, and refuses to remove the last `is_owner=1` user from a list.
- Confirm `POST /list-users` rejects the 11th user added to a list with a clear "list is full" error.
- Confirm a new list created via `POST /admin/owners` already has the ~100 `COMMON_ITEMS` in its catalogue, in the right categories.
- Confirm granting `is_owner=1` to a second user on the same `list_id` (via the admin flags endpoint) actually lets that second user manage members/see the owner panel — multi-owner works end-to-end.

---

## Analysis: should this be done?

**Yes, with caveats.** The current architecture (hardcoded 2-user globals everywhere) is the actual blocker to any growth — there's no incremental way to add a third user today without that user seeing/polluting the existing household's list. The proposed change is a moderate, well-contained schema + query change (add `list_id`, scope every existing query by it) rather than a rewrite, and reuses 100% of the existing CRUD logic and frontend UI.

**Pros**
- Turns a personal 2-user tool into something shareable with friends/family without compromising the original household's data.
- Isolation is enforced server-side from `user.list_id` (derived from the authenticated JWT/DB row), not from client-supplied list IDs — hard to get cross-list leakage wrong.
- No new infra: still D1 + one Worker, still no build step, still fits the project's "no dependencies" philosophy.
- Backfill is one migration; zero downtime, no manual data re-entry for the existing two users.

**Limitations / things this does *not* solve**
- **D1 scaling**: D1 is fine at low-tens-of-households scale (free tier: 5GB, 25M row reads/day) but this plan doesn't add connection pooling, caching, or sharding — if "scale" means hundreds/thousands of households, D1's per-database limits and the Worker's single sequential `if (path === ...)` router would need revisiting separately. For "more than two people, a handful of households," this plan is sufficient.
- **No self-service signup**: by design (admin/owner gated creation), so this doesn't turn it into a public product — it stays invite-only, which matches what you described. _(Update: self-service signup and "Sign in with Google" were later added in `migrations/0010_signup_and_recovery.sql`, alongside the invite-only paths this plan describes — see `CLAUDE.md`'s Auth model section.)_
- **Per-list catalogues, partly mitigated**: each new list still keeps its own independent catalogue (required for isolation), but is now seeded with ~100 common Norwegian grocery items at creation, so households aren't starting from a blank catalogue. This only covers the *common* case — anything unusual a household buys still has to be typed once, same as today.
- **Quota now capped, not unlimited**: a hard 10-users-per-list cap (owner included) bounds the worst case of credential-leak abuse and keeps `GET /list-users` cheap; there's still no usage auditing/billing beyond that fixed cap, which is fine for invite-only friends-and-family use but wouldn't scale to a real multi-tenant SaaS without more (rate limits, abuse monitoring, etc.).
- **Stale-token window**: without the `token_version` bump fixes folded into this plan, a 90-day JWT would let a removed/demoted user keep their old access for up to 90 days — this is now addressed (every role/list_id/removal mutation bumps `token_version`), but it's a sharp edge worth remembering if new mutation endpoints are added later without copying that pattern.

**Net assessment**: this is a reasonable, scoped change that matches the stated requirements closely and fits the existing architecture's constraints (no bundler, single Worker file, D1). All open decisions raised during planning are now resolved: roles are independent flags (`is_admin`, `is_owner`) rather than a single enum, your own account gets both, lists can have multiple owners, members are capped at 10 per list, new lists are seeded with common Norwegian items, and password resets are available to the admin.
