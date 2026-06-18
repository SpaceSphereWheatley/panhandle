# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Panhandle: a shared shopping list + meal planner PWA for two people, deployed entirely on Cloudflare (Pages + Worker + D1). Live at https://shopping.mohibb.com.

There is no build step and no Node toolchain in this repo. Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration (not GitHub Actions) — pushing to `main` auto-deploys both. Do not introduce bundlers, package.json, or frameworks unless explicitly asked.

## Architecture

- **`worker/index.js`** — single-file Cloudflare Worker. Handles all `/api/*` and `/seed` routes, and proxies any non-API request to the Pages project (hostname hardcoded near `pagesUrl.hostname`, currently `panhandle-ecj.pages.dev`). This is the entire backend: routing, auth, and business logic all live in one `fetch` handler with sequential `if (path === ...)` checks.
- **`public/`** — static frontend served by Cloudflare Pages (no framework, no build): `index.html` (the app, single file with inline `<style>`/`<script>`), `seed.html` (one-time account creation form, posts to `/seed`), `manifest.json`, icons. Pages build output directory is `public/`, no build command.
- **`migrations/`** — SQL run manually in the D1 console, in order: `0001_init.sql` (shopping list + meal tables), `0002_users.sql` (users table), `0003_list_items_qty_notes.sql` (qty + notes columns), `0004_seed_catalogue.sql` (non-destructive, re-runnable upsert that ensures ~506 common Norwegian household items exist in every list's `item_catalogue`, overwriting an item's category on conflict; no longer wipes data), `0005_multi_tenant.sql` (per-list isolation: `lists` table, `is_admin`/`is_owner`/`list_id`/`created_by` on `users`, `list_id` on the data tables, compound per-list `UNIQUE`s; coordinated cutover documented in `docs/multi-tenant-setup.md`), `0006_expand_catalogue.sql` (same non-destructive upsert pattern as 0004, adding 200 more catalogue items — exotic produce, more bread/dairy/meat/fish variants, sauces/spices/baking staples, frozen, grains/noodles, snacks, drinks, household, health, pet, misc — on top of 0004's ~506, for ~706 total). Migrations are applied with Wrangler's built-in D1 migrations runner (`npx wrangler d1 migrations apply panhandle --remote`), which tracks applied files in the `d1_migrations` table inside the DB itself — see `wrangler.toml`. New schema/data changes still just need a new numbered `.sql` file in `migrations/`; running the command above applies only the ones not yet recorded in `d1_migrations`.

### Deployment (Cloudflare Git integration)

- Both the Pages project and the Worker are configured in the Cloudflare dashboard to track `main` directly — no `.github/workflows/` exist in this repo.
- Worker deploy command (set in Cloudflare dashboard): `npx wrangler deploy`, reading `wrangler.toml` at repo root.
- Worker runtime secrets (`JWT_SECRET`, `SEED_SECRET`) are set in the Worker's dashboard (Settings → Variables and Secrets) and are independent of the Git integration — they persist across deploys and are never defined in `wrangler.toml` or committed to the repo.

### Auth model (worker/index.js)

- Passwords: PBKDF2 (100k iterations, SHA-256) via Web Crypto, no external deps — see `hashPassword`/`verifyPassword`.
- Tokens: hand-rolled HS256 JWT (`signJwt`/`verifyJwt`), signed with `env.JWT_SECRET`.
- Every JWT carries `tv` (token_version). `requireAuth` checks the JWT against the DB's current `token_version` for that user — changing a password bumps `token_version`, which invalidates all other devices' tokens immediately even though those tokens haven't expired.
- Sliding expiry: every authenticated response includes a fresh token in the `X-Refresh-Token` header (see `mintToken`, used for `/list` and the post-auth flow). The frontend (`public/index.html`) reads this header in its `api()` wrapper and re-stores the token, except on `/change-password` (whose response body — not header — carries the authoritative new-version token).
- `/seed` is a one-time, secret-gated endpoint (`env.SEED_SECRET`) for bootstrapping the first account(s); it's meant to be disabled (remove the secret from Cloudflare) after first use. Post-multi-tenant it makes the first new account admin+owner of a freshly seeded list and only password-resets existing users.

### Multi-tenant model (post `0005_multi_tenant.sql`)

- Every user belongs to exactly one `list_id`; all shopping/meal/catalogue data is scoped by it (`WHERE list_id = user.list_id`). Isolation is derived server-side from the authenticated user's DB row — `list_id`/`is_admin`/`is_owner` are **never** accepted as request input.
- `is_admin` and `is_owner` are independent 0/1 flags (a user can be both); "member" = neither flag. A list can have multiple owners. The JWT carries `list_id`/`is_admin`/`is_owner` for client display, but `requireAuth` re-reads them from the DB every request. Any flag/`list_id`/removal change bumps the target's `token_version` (deletion is handled by the missing-row 401 instead).
- Admin endpoints (`is_admin`): `POST /admin/owners`, `GET /admin/users`, `POST /admin/users/{u}/reset-password`, `PATCH /admin/users/{u}/flags` (refuses to demote the last admin or remove a list's only owner). Owner endpoints (`is_owner`): `POST /list-users` (10-user cap, member flags server-forced to 0), `DELETE /list-users/{u}`. `GET /list-users` is open to any member of the list (drives the meal-responsible dropdown).
- New lists are seeded with the hardcoded `COMMON_ITEMS` (~110 common Norwegian items) at creation; it's a one-time copy, not a synced shared table.

### Data flow

- Shopping items reference a shared `item_catalogue` (name + category) so a name typed once is remembered with its category afterward; `list_items` just tracks bought/added-by state against a catalogue entry.
- Meals follow the same pattern: `meal_catalogue` holds known meal names, `meal_plan` assigns one meal + a responsible person to a given `plan_date` (one row per date, upserted via `ON CONFLICT(plan_date)`). `meal_plan` has no long-term history: the frontend only ever navigates to last/this/next week (`weekOffset` clamped to `[-1, 1]` in `public/index.html`), and `GET /plan` opportunistically deletes rows older than 14 days on every read — there's no cron trigger, so cleanup piggybacks on normal traffic. `meal_catalogue` (the reusable meal *names*, for autocomplete) is unaffected and keeps growing.
- Frontend polls `/list` and `/plan` every 7 seconds while the relevant tab is active (no websockets/push).

### Categories and people

`CATEGORIES` is duplicated in both `worker/index.js` (server-side validation/default) and `public/index.html` (display grouping) — keep them in sync if changed. People are no longer hardcoded: the frontend's `people()` derives the meal-responsible list from `GET /list-users` (the members of the current list). `COMMON_ITEMS` (new-list catalogue seed) lives only in `worker/index.js`.

### Versioning

There's a single version number, duplicated (no build step to inject it): `VERSION` in `worker/index.js` and `APP_VERSION` in `public/index.html` — bump both together on a release and add a `CHANGELOG.md` entry. The Worker and Pages deploy independently, so the Profile page reads `GET /api/version` (public, unauthenticated) and shows both the app and API versions; a mismatch means one half of a deploy is still in flight or stale.

## Deployment

There is no local dev server or test suite. Changes are validated by deploying:
- Worker changes: push to `main` — Cloudflare's Git integration runs `npx wrangler deploy` automatically.
- Frontend changes: push to `main` — Cloudflare Pages rebuilds `public/` automatically.
- Schema changes: add a new numbered file in `migrations/`, then run `npx wrangler d1 migrations apply panhandle --remote` (requires `wrangler login` or `CLOUDFLARE_API_TOKEN`). This is not wired into the Git integration/CI — it's a manual step a developer runs locally after pushing/merging the migration file.
