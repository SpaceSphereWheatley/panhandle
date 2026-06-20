# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Panhandle: a shared shopping list + meal planner PWA for two people, deployed entirely on Cloudflare (Pages + Worker + D1). Live at https://shopping.mohibb.com.

There is no build step and no Node toolchain in this repo. Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration (not GitHub Actions) — pushing to `main` auto-deploys both. Do not introduce bundlers, package.json, or frameworks unless explicitly asked.

## Architecture

- **`worker/index.js`** — single-file Cloudflare Worker. Handles all `/api/*` and `/seed` routes, and proxies any non-API request to the Pages project (hostname hardcoded near `pagesUrl.hostname`, currently `panhandle-ecj.pages.dev`). This is the entire backend: routing, auth, and business logic all live in one `fetch` handler with sequential `if (path === ...)` checks.
- **`public/`** — static frontend served by Cloudflare Pages (no framework, no build): `index.html` (the app, single file with inline `<style>`/`<script>`), `seed.html` (one-time account creation form, posts to `/seed`), `manifest.json`, icons. Pages build output directory is `public/`, no build command.
- **`migrations/`** — SQL applied via Wrangler's D1 migrations runner (`npx wrangler d1 migrations apply panhandle --remote`), which tracks applied filenames in the `d1_migrations` table inside the DB itself — see `wrangler.toml`. `0001_init.sql` holds the full consolidated schema (lists, users, item_catalogue, list_items, meal_catalogue, meal_plan, login_attempts, and all indexes) — this project has exactly one deployment, so the original incremental migrations (users table, qty/notes columns, multi-tenant cutover, login-rate-limiting table) were squashed into it rather than kept as separate ordered steps. `0002_seed_catalogue.sql` and `0003_expand_catalogue.sql` are pure data seeds (non-destructive, re-runnable upserts that ensure ~706 common Norwegian household items exist in every list's `item_catalogue`, overwriting an item's category on conflict; never wipe data) — both depend on `lists`/`list_id` from `0001_init.sql`, which is why they're numbered after it. New schema/data changes just need a new numbered `.sql` file in `migrations/`; running the command above applies only the ones not yet recorded in `d1_migrations`.

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

### Multi-tenant model

- Every user belongs to exactly one `list_id`; all shopping/meal/catalogue data is scoped by it (`WHERE list_id = user.list_id`). Isolation is derived server-side from the authenticated user's DB row — `list_id`/`is_admin`/`is_owner` are **never** accepted as request input.
- `is_admin` and `is_owner` are independent 0/1 flags (a user can be both); "member" = neither flag. A list can have multiple owners. The JWT carries `list_id`/`is_admin`/`is_owner` for client display, but `requireAuth` re-reads them from the DB every request. Any flag/`list_id`/removal change bumps the target's `token_version` (deletion is handled by the missing-row 401 instead).
- Admin endpoints (`is_admin`): `POST /admin/owners`, `GET /admin/users`, `POST /admin/users/{u}/reset-password`, `PATCH /admin/users/{u}/flags` (refuses to demote the last admin or remove a list's only owner). Owner endpoints (`is_owner`): `POST /list-users` (10-user cap, member flags server-forced to 0), `DELETE /list-users/{u}`. `GET /list-users` is open to any member of the list (drives the meal-responsible dropdown).
- New lists are seeded with the hardcoded `COMMON_ITEMS` (~110 common Norwegian items) at creation; it's a one-time copy, not a synced shared table.

### Data flow

- Shopping items reference a shared `item_catalogue` (name + category) so a name typed once is remembered with its category afterward; `list_items` just tracks bought/added-by state against a catalogue entry.
- Meals follow the same pattern: `meal_catalogue` holds known meal names, `meal_plan` assigns one meal + a responsible person to a given `plan_date` (one row per date, upserted via `ON CONFLICT(plan_date)`). `meal_plan` has no long-term history: the frontend only ever navigates to last/this/next week (`weekOffset` clamped to `[-1, 1]` in `public/index.html`), and `GET /plan` opportunistically deletes rows older than 14 days on every read — there's no cron trigger, so cleanup piggybacks on normal traffic. `meal_catalogue` (the reusable meal *names*, for autocomplete) is unaffected and keeps growing. `meal_catalogue.labels` (added in `0006_meal_labels.sql`) is a free-form, user-typed JSON string array, sanitized server-side (`sanitizeLabels` in `worker/index.js`) — trimmed, capitalized, deduped case-insensitively — with no fixed vocabulary; the editor's autocomplete (`allKnownLabels()` in `public/app.html`) just suggests labels already used elsewhere in the catalogue to discourage near-duplicates.
- Frontend polls `/list` and `/plan` every 7 seconds while the relevant tab is active (no websockets/push).

### Categories and people

`CATEGORIES` is duplicated in both `worker/index.js` (server-side validation/default) and `public/index.html` (display grouping) — keep them in sync if changed. People are no longer hardcoded: the frontend's `people()` derives the meal-responsible list from `GET /list-users` (the members of the current list). `COMMON_ITEMS` (new-list catalogue seed) lives only in `worker/index.js`.

### Versioning

There's a single version number, duplicated (no build step to inject it): `VERSION` in `worker/index.js` and `APP_VERSION` in `public/app.html` — bump both together on a release and add a `CHANGELOG.md` entry. The Worker and Pages deploy independently, so the Profile page reads `GET /api/version` (public, unauthenticated) and shows both the app and API versions; a mismatch means one half of a deploy is still in flight or stale.

`CHANGELOG.md` is also duplicated into `public/CHANGELOG.md` so Cloudflare Pages serves it as a static asset (the repo-root copy isn't in the Pages build output dir) — the frontend fetches `/CHANGELOG.md` directly to show a changelog modal (triggered from the "Om" settings subpage, and from a one-time toast when a device's last-seen `APP_VERSION` doesn't match the current one). Copy the updated `CHANGELOG.md` into `public/` whenever it changes.

Version bump convention (`MAJOR.MINOR.PATCH`): every release so far has only bumped PATCH, even for substantial changes (dark mode, multi-tenant support). Going forward — bump MINOR for a release that adds a new user-facing capability or completes a planned phase/epic; bump PATCH for fixes, tweaks, and small additions; MAJOR is reserved for breaking changes (e.g. an incompatible API/schema change requiring coordinated migration).

## Deployment

There is no local dev server or test suite. Changes are validated by deploying:
- Worker changes: push to `main` — Cloudflare's Git integration runs `npx wrangler deploy` automatically.
- Frontend changes: push to `main` — Cloudflare Pages rebuilds `public/` automatically.
- Schema changes: add a new numbered file in `migrations/`, then run `npx wrangler d1 migrations apply panhandle --remote` (requires `wrangler login` or `CLOUDFLARE_API_TOKEN`). This is not wired into the Git integration/CI — it's a manual step a developer runs locally after pushing/merging the migration file.

### Applying migrations without a local install

The developer doesn't install anything locally — everything goes through Claude Code or the Cloudflare web dashboard. Claude Code sessions (including the sandboxed ones used for most work in this repo) generally have **no** `CLOUDFLARE_API_TOKEN`/`wrangler login` session, so `wrangler d1 migrations apply --remote` can't run from inside them, and Claude Code's permission system correctly blocks an agent from running the equivalent raw SQL through the Cloudflare D1 MCP query tool as a workaround (it bypasses the documented migration process without a real audit trail). This has bitten multiple past sessions (see PR #27's note about being blocked, and the manual fixes described in PR #29's and the 0001_init.sql-consolidation commit's messages).

The actual way to apply a migration against production, with no local installs:
1. Open **dash.cloudflare.com → Storage & Databases → D1 → `panhandle` → Console** tab.
2. Paste in the new migration file's SQL, run it.
3. Also run `INSERT INTO d1_migrations (name, applied_at) VALUES ('00NN_filename.sql', datetime('now'));` so Wrangler's own tracking table stays in sync and a later `wrangler d1 migrations apply` run doesn't try to re-run (and fail on) the same file.
4. Ask Claude Code to verify the result via the Cloudflare D1 MCP query tool (read-only schema/data checks are fine through that channel — it's only the schema-mutating workaround that's blocked).
