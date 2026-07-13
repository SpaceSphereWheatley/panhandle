# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Panhandle: a shared shopping list + meal planner PWA for two people, deployed entirely on Cloudflare (Pages + Worker + D1). Live at https://shopping.mohibb.com.

Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration (not GitHub Actions) — pushing to `main` auto-deploys both.

The frontend was rewritten from a hand-rolled, no-build vanilla JS/HTML app to a Vite + React build (see `src/` under Architecture below) — **this is now the live app.** Cloudflare Pages' build command is `npm run build`, output directory `dist`. The old vanilla app (`public/app.html`, `public/itemIcons.js`, `public/uiIcons.js`) has been deleted — it was never served in production (the Vite build's own `dist/app.html` always overwrote the copied-through one) and its functionality was fully ported to `src/lib/itemIcons.js`/`src/lib/uiIcons.js` and Phosphor icons. `public/index.html` (a separate static marketing/landing page) and `public/seed.html`/`manifest.json`/icons are still real, unrelated to this rewrite, and still served as-is via Vite's `publicDir` copy-through.

## Architecture

- **`worker/index.js`** — single-file Cloudflare Worker. Handles all `/api/*` and `/seed` routes, and proxies any non-API request to the Pages project (hostname hardcoded near `pagesUrl.hostname`, currently `panhandle-ecj.pages.dev`). This is the entire backend: routing, auth, and business logic all live in one `fetch` handler with sequential `if (path === ...)` checks.
- **`src/`, `package.json`, `vite.config.js`, root `app.html`** — the **live** frontend: a Vite + React app (all three tabs — shopping list (`src/tabs/ShoppingListTab.jsx`), meals (`src/tabs/MealsTab.jsx`), settings (`src/tabs/SettingsTab.jsx`)). Built by Cloudflare Pages via `npm run build` to `dist/`. The Vite entry is named `app.html` (not `index.html`) specifically so it builds to `dist/app.html`, matching the real app's URL (`shopping.mohibb.com/app.html`) and leaving `public/index.html`'s copy-through (via Vite's `publicDir`, still pointed at `public/`) untouched at `dist/index.html` instead of colliding with it.
- **`public/`** — static assets Vite copies verbatim into `dist/` (`publicDir`): `index.html` (a static marketing/landing page, unauthenticated, links to `/app.html`), `seed.html` (one-time account creation form, posts to `/seed`), `manifest.json`, icons, `CHANGELOG.md`.
- **`migrations/`** — SQL applied via Wrangler's D1 migrations runner (`npx wrangler d1 migrations apply panhandle --remote`), which tracks applied filenames in the `d1_migrations` table inside the DB itself — see `wrangler.toml`. `0001_init.sql` holds the full consolidated schema (lists, users, item_catalogue, list_items, meal_catalogue, meal_plan, login_attempts, and all indexes) — this project has exactly one deployment, so the original incremental migrations (users table, qty/notes columns, multi-tenant cutover, login-rate-limiting table) were squashed into it rather than kept as separate ordered steps. `0002_seed_catalogue.sql` and `0003_expand_catalogue.sql` are pure data seeds (non-destructive, re-runnable upserts that ensure ~706 common Norwegian household items exist in every list's `item_catalogue`, overwriting an item's category on conflict; never wipe data) — both depend on `lists`/`list_id` from `0001_init.sql`, which is why they're numbered after it. New schema/data changes just need a new numbered `.sql` file in `migrations/`; running the command above applies only the ones not yet recorded in `d1_migrations`.

### Deployment (Cloudflare Git integration)

- Both the Pages project and the Worker are configured in the Cloudflare dashboard to track `main` directly — no `.github/workflows/` exist in this repo.
- Worker deploy command (set in Cloudflare dashboard): `npx wrangler deploy`, reading `wrangler.toml` at repo root.
- Worker runtime secrets (`JWT_SECRET`, `SEED_SECRET`) are set in the Worker's dashboard (Settings → Variables and Secrets) and are independent of the Git integration — they persist across deploys and are never defined in `wrangler.toml` or committed to the repo.

### Auth model (worker/index.js)

- Passwords: PBKDF2 (100k iterations, SHA-256) via Web Crypto, no external deps — see `hashPassword`/`verifyPassword`.
- Tokens: hand-rolled HS256 JWT (`signJwt`/`verifyJwt`), signed with `env.JWT_SECRET`.
- Every JWT carries `tv` (token_version). `requireAuth` checks the JWT against the DB's current `token_version` for that user — changing a password bumps `token_version`, which invalidates all other devices' tokens immediately even though those tokens haven't expired.
- Sliding expiry: every authenticated response includes a fresh token in the `X-Refresh-Token` header (see `mintToken`, used for `/list` and the post-auth flow). The frontend (`src/lib/api.js`) reads this header in its `api()` wrapper and re-stores the token via `AuthContext`, except on `/change-password` (whose response body — not header — carries the authoritative new-version token).
- `/seed` is a one-time, secret-gated endpoint (`env.SEED_SECRET`) for bootstrapping the first account(s); it's meant to be disabled (remove the secret from Cloudflare) after first use. Post-multi-tenant it makes the first new account admin+owner of a freshly seeded list and only password-resets existing users.

### Multi-tenant model

- Every user belongs to exactly one `list_id`; all shopping/meal/catalogue data is scoped by it (`WHERE list_id = user.list_id`). Isolation is derived server-side from the authenticated user's DB row — `list_id`/`is_admin`/`is_owner` are **never** accepted as request input.
- `is_admin` and `is_owner` are independent 0/1 flags (a user can be both); "member" = neither flag. A list can have multiple owners. The JWT carries `list_id`/`is_admin`/`is_owner` for client display, but `requireAuth` re-reads them from the DB every request. Any flag/`list_id`/removal change bumps the target's `token_version` (deletion is handled by the missing-row 401 instead).
- Admin endpoints (`is_admin`): `POST /admin/owners`, `GET /admin/users`, `POST /admin/users/{u}/reset-password`, `PATCH /admin/users/{u}/flags` (refuses to demote the last admin or remove a list's only owner). Owner endpoints (`is_owner`): `POST /list-users` (10-user cap, member flags server-forced to 0), `DELETE /list-users/{u}`. `GET /list-users` is open to any member of the list (drives the meal-responsible dropdown).
- New lists are seeded with the hardcoded `COMMON_ITEMS` (~110 common Norwegian items) at creation; it's a one-time copy, not a synced shared table.

### Data flow

- Shopping items reference a shared `item_catalogue` (name + category) so a name typed once is remembered with its category afterward; `list_items` just tracks bought/added-by state against a catalogue entry.
- Meals follow the same pattern: `meal_catalogue` holds known meal names, `meal_plan` assigns one meal + a responsible person to a given `plan_date` (one row per date, upserted via `ON CONFLICT(plan_date)`). `meal_plan` has no long-term history: the frontend only ever navigates within `[WEEK_MIN, WEEK_MAX]` = `[-1, 4]` weeks of the current week (`src/lib/mealUtils.js`, used by `src/tabs/MealsTab.jsx`), and `GET /plan` opportunistically deletes rows older than 14 days on every read — there's no cron trigger, so cleanup piggybacks on normal traffic. `meal_catalogue` (the reusable meal *names*, for autocomplete) is unaffected and keeps growing. `meal_catalogue.labels` (added in `0006_meal_labels.sql`) is a free-form, user-typed JSON string array, sanitized server-side (`sanitizeLabels` in `worker/index.js`) — trimmed, capitalized, deduped case-insensitively — with no fixed vocabulary; the editor's autocomplete (computed inline in `src/components/meals/MealEditModal.jsx` and `MealCatalogueBrowseModal.jsx`) just suggests labels already used elsewhere in the catalogue to discourage near-duplicates.
- Frontend polls `/list` and `/plan` every 7 seconds while the relevant tab is active (no websockets/push).

### Categories and people

`CATEGORIES` is duplicated in both `worker/index.js` (server-side validation/default) and `src/lib/shoppingUtils.js` (display grouping) — keep them in sync if changed. People are no longer hardcoded: `src/context/ListUsersContext.jsx` derives the meal-responsible list from `GET /list-users` (the members of the current list). `COMMON_ITEMS` (new-list catalogue seed) lives only in `worker/index.js`.

### Versioning

There's a single version number, duplicated: `VERSION` in `worker/index.js` and `APP_VERSION` in `src/lib/version.js` — bump both together on a release and add a `CHANGELOG.md` entry. (`public/app.html`'s own `APP_VERSION` is stale/unused now that it's no longer served — don't bother bumping it.) The Worker and Pages deploy independently, so the Profile page reads `GET /api/version` (public, unauthenticated) and shows both the app and API versions; a mismatch means one half of a deploy is still in flight or stale.

`CHANGELOG.md` is also duplicated into `public/CHANGELOG.md` so Vite's `publicDir` copy-through carries it into `dist/` as a static asset (the repo-root copy isn't in the Pages build output dir) — the frontend fetches `/CHANGELOG.md` directly to show a changelog modal (triggered from the "Om" settings subpage via `src/components/ChangelogModal.jsx`, and from a one-time toast when a device's last-seen `APP_VERSION` doesn't match the current one, see `src/hooks/useDeployVersionCheck.js`). Copy the updated `CHANGELOG.md` into `public/` whenever it changes.

Version bump convention (`MAJOR.MINOR.PATCH`): every release so far has only bumped PATCH, even for substantial changes (dark mode, multi-tenant support). Going forward — bump MINOR for a release that adds a new user-facing capability or completes a planned phase/epic; bump PATCH for fixes, tweaks, and small additions; MAJOR is reserved for breaking changes (e.g. an incompatible API/schema change requiring coordinated migration).

## Workflow conventions

When the user says "finish up" (or similar) on a branch with work ready to ship, the standard flow is: sync the branch with `main`, push, open a PR, wait for checks/review, then merge — without needing to ask at each step. There's no CI in this repo (see Deployment below), so "waiting" mostly means watching for the Cloudflare deploy-preview bot comment and any review feedback before merging.

## Deployment

There is no test suite for the live app. Changes are validated by deploying:
- Worker changes: push to `main` — Cloudflare's Git integration runs `npx wrangler deploy` automatically.
- Frontend changes (`src/`): push to `main` — Cloudflare Pages runs `npm run build` and deploys `dist/` automatically. `npm install && npm run build` can also be run wherever Node is available (including inside a Claude Code session) to validate a change before pushing; `npm run dev` runs Vite's local dev server (starts at `/app.html`).
- Schema changes: add a new numbered file in `migrations/`, then run `npx wrangler d1 migrations apply panhandle --remote` (requires `wrangler login` or `CLOUDFLARE_API_TOKEN`). This is not wired into the Git integration/CI — it's a manual step a developer runs locally after pushing/merging the migration file.

### Applying migrations without a local install

The developer doesn't install anything locally — everything goes through Claude Code or the Cloudflare web dashboard. Claude Code sessions (including the sandboxed ones used for most work in this repo) generally have **no** `CLOUDFLARE_API_TOKEN`/`wrangler login` session, so `wrangler d1 migrations apply --remote` can't run from inside them.

**The `mcp__Cloudflare_Developer_Platform__d1_database_query` tool is allowed in `.claude/settings.json`**, so Claude can run SQL against production D1 directly without the user going to the Cloudflare dashboard. Use it to apply migrations and verify schema/data.

The preferred way to apply a migration against production:
1. Write the migration SQL file in `migrations/` as usual.
2. Run the SQL via `mcp__Cloudflare_Developer_Platform__d1_database_query` (Claude can do this in auto mode without prompting).
3. Also run `INSERT INTO d1_migrations (name, applied_at) VALUES ('00NN_filename.sql', datetime('now'));` so Wrangler's tracking table stays in sync.
4. Verify the result with a follow-up query via the same tool.
