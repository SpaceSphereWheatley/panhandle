# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Panhandle: a shared shopping list + meal planner PWA for a household (solo, or up to 10 people — see Multi-tenant model), deployed entirely on Cloudflare (Pages + Worker + D1). Live at https://shopping.mohibb.com. Both the Pages project and the Worker track `main` directly via Cloudflare's native Git integration (not GitHub Actions) — pushing to `main` auto-deploys both.

The frontend is a Vite + React build (`src/`) — this is the live app. Cloudflare Pages builds it with `npm run build` → `dist/`.

## Architecture

- **`worker/index.js`** — single-file Cloudflare Worker. Handles all `/api/*` routes, proxies everything else to the Pages project. Entire backend: routing, auth, and business logic in one `fetch` handler with sequential `if (path === ...)` checks.
- **`src/`, `package.json`, `vite.config.js`, root `app.html`** — the live frontend: three tabs (`src/tabs/ShoppingListTab.jsx`, `MealsTab.jsx`, `SettingsTab.jsx`). The Vite entry is named `app.html` (not `index.html`) so it builds to `dist/app.html` without colliding with `public/index.html`'s copy-through — see `docs/architecture-notes.md` for the full rationale and the pre-rewrite history. `scripts/compute-icon-offsets.mjs` is a manual dev tool for re-centering hand-drawn icons in `src/lib/itemIcons.js` — see its own header comment.
- **`public/`** — static assets Vite copies verbatim into `dist/`: `index.html` (unauthenticated marketing/landing page, links to `/app.html`), `changelog.html` (unauthenticated full-changelog page rendering `/CHANGELOG.md`, see Versioning), `manifest.json`, icons, `CHANGELOG.md`. `favicon.svg`/`favicon-32.png`/`favicon.ico` are rasterized from the same `src/design-system/assets/logo/panhandle-icon.svg` mark the app icons use (no ImageMagick/PIL in this environment, so built via a one-off Node script: Playwright Chromium to rasterize, a manual ICO writer to pack it — same Playwright-Chromium pattern as `scripts/compute-icon-offsets.mjs`) and linked from `app.html`/`index.html`/`changelog.html`'s `<head>`; regenerate by hand if `panhandle-icon.svg` ever changes.
- **`migrations/`** — SQL applied via Wrangler's D1 migrations runner, tracked in the `d1_migrations` table (see `wrangler.toml`). `0001_init.sql` is the full consolidated base schema; every later file is additive. New schema/data changes are just a new numbered `.sql` file — see `docs/architecture-notes.md` for the per-migration history, and "Applying migrations" below for how to actually run one.

### Deployment (Cloudflare Git integration)

- Both projects track `main` in the Cloudflare dashboard — no `.github/workflows/` deploy anything.
- Worker deploy command: `npx wrangler deploy`, reading `wrangler.toml`.
- Worker runtime secrets live in the Worker's dashboard (never in `wrangler.toml` or the repo): `JWT_SECRET`, `RESEND_API_KEY` (Resend email), `TURNSTILE_SECRET_KEY` (CAPTCHA on public endpoints), `FEEDBACK_EMAIL`, `SUPERADMIN_USERNAMES` (comma-separated allowlist, see Multi-tenant model).

### Auth model (worker/index.js)

- Passwords: PBKDF2 (100k iterations, SHA-256) via Web Crypto (`hashPassword`/`verifyPassword`). Tokens: hand-rolled HS256 JWT (`signJwt`/`verifyJwt`), signed with `env.JWT_SECRET`.
- Every JWT carries `tv` (token_version); `requireAuth` checks it against the DB's current value, so a password change or admin/owner flag change invalidates other devices' tokens immediately even though those tokens haven't expired.
- Sliding expiry: authenticated responses include a fresh token in `X-Refresh-Token` (`mintToken`); `src/lib/api.js` re-stores it via `AuthContext`. `/change-password` and `/change-email` instead return the new token in the response body, since both bump `token_version` or rename the JWT's `sub`.
- No admin-bootstrap backdoor: `POST /register` (Turnstile-gated), `POST /auth/google` (matched on `google_sub`), and `POST /forgot-password`/`POST /reset-password` (single-use, hashed tokens, emailed via Resend) are the only ways to create or recover an account. `/register`, `/forgot-password`, `POST /feedback` are IP-rate-limited via the shared `rate_limit_attempts` table (`checkRateLimit`/`recordAttempt`).
- Three editable identity fields: `username` (always equals `email`, server-enforced), `email`, `name` (free-typed display name). `POST /change-email` renames the username everywhere it's copied by value (`list_items.added_by`, `meal_plan.responsible`, `recurring_schedule.responsible`, `users.created_by`, `password_resets.username` — see `renameUsername`), not a single-column update.
- `isSuperAdmin` (checks `env.SUPERADMIN_USERNAMES`) is orthogonal to and stronger than per-list `is_admin`/`is_owner`; gates `GET /admin/metrics` and `DELETE /admin/users/{u}`.
- Every user can `GET`/`DELETE /account` (self-delete, current-password + IP-throttle). The sole/last owner of a list self-deleting cascade-deletes the whole list instead of being refused (unlike the admin-facing removal endpoints, which refuse on the last owner).

### Multi-tenant model

- Every user belongs to exactly one `list_id`; all shopping/meal/catalogue data is scoped by it server-side — `list_id`/`is_admin`/`is_owner` are **never** accepted as request input.
- `is_admin`/`is_owner` are independent 0/1 flags (a list can have multiple owners; "member" = neither). The JWT carries them for client display only — `requireAuth` re-reads from the DB every request. Any flag/`list_id` change bumps the target's `token_version`.
- Admin endpoints (`is_admin`): `POST /admin/owners`, `GET /admin/users`, `POST /admin/users/{u}/reset-password`, `PATCH /admin/users/{u}/flags` (refuses to demote the last admin or remove a list's only owner). Owner endpoints (`is_owner`): `POST /list-users` (10-user cap, member flags server-forced to 0), `DELETE /list-users/{u}`. `GET /list-users` is open to any list member (drives the meal-responsible dropdown). Superadmin-only: `GET /admin/metrics`, `DELETE /admin/users/{u}`.
- New lists are seeded with the hardcoded `COMMON_ITEMS` array (710 common Norwegian items) at creation — a one-time copy, not a synced shared table.

### Data flow

- Shopping items reference a shared `item_catalogue` (name + category) so a name typed once is remembered with its category; `list_items` tracks bought/added-by state against a catalogue entry. `item_catalogue.times_bought`/`first_bought`/`last_bought` are durable, never-pruned counters powering `GET /catalogue/suggestions`.
- Meals follow the same pattern: `meal_catalogue` holds known meal names, `meal_plan` assigns one meal + a responsible person per `plan_date` (upserted via `ON CONFLICT(plan_date)`). The frontend only ever navigates `[WEEK_MIN, WEEK_MAX]` = `[-1, 4]` weeks of the current week (`src/lib/mealUtils.js`); `GET /plan` opportunistically deletes rows older than 14 days on every read (no cron trigger). `meal_catalogue.times_planned`/`last_planned` power `GET /meals/suggestions`. `meal_plan.meal_id` is nullable with `ON DELETE SET NULL`, so deleting a catalogue meal unassigns it from a planned day (keeping `responsible`) instead of deleting the row. `meal_catalogue.labels` is a free-form, user-typed JSON string array, sanitized via `sanitizeLabels` (trimmed, capitalized, deduped case-insensitively).
- `recurring_schedule` holds at most one row per `list_id`+`day_of_week`, each with a `responsible` person — a standing weekly default, separate from `meal_plan`'s per-date assignments.
- Frontend polls `/list` and `/plan` every 7 seconds while the relevant tab is active (no websockets/push).

### Categories and people

`CATEGORIES` lives in `shared/categories.js`, imported by both `worker/index.js` and `src/lib/shoppingUtils.js` — same single-source pattern as `VERSION` (see Versioning). People are derived from `GET /list-users` (`src/context/ListUsersContext.jsx`), not hardcoded. `COMMON_ITEMS` (new-list catalogue seed) lives only in `worker/index.js`.

### Versioning

Single version number, `VERSION` in `shared/version.js`, imported by both `worker/index.js` and `src/lib/version.js`. `GET /api/version` (public) exposes both app and API versions, so a mismatch on the Profile page means one half of a deploy is still in flight. `CHANGELOG.md` is auto-copied to `public/CHANGELOG.md` on every build (`scripts/sync-changelog.mjs`, wired into `prebuild`) — editing the root file is enough. `public/changelog.html` and `ChangelogModal` both render it (full history vs. compact per-version titles respectively) — see `docs/architecture-notes.md` for why they use separate parsers.

Version bump convention (`MAJOR.MINOR.PATCH`): bump MINOR for a release adding a new user-facing capability or completing a planned phase/epic; PATCH for fixes/tweaks/small additions; MAJOR only for breaking changes.

## Workflow conventions

When the user says "finish up" (or similar) on a branch with work ready to ship: sync with `main`, push, open a PR, wait for checks/review, then merge — without needing to ask at each step. CI (`.github/workflows/ci.yml`: lint, secret-scan, migration-numbering check, frontend build+unit-tests, backend unit-tests) doesn't gate deploys — Cloudflare's Git integration deploys independently of GH Actions results. So "waiting" means watching CI status, the Cloudflare deploy-preview bot comment, and review feedback before merging.

**No PR gets merged without a version bump.** Every merge to `main` immediately redeploys the live app, so bumping `VERSION` and adding a matching `CHANGELOG.md` entry is part of what "ready to merge" means, not optional cleanup — do it in the same PR before merging, whatever the change (including docs-only changes to this file).

If changes related to anything in CLAUDE.md are made, the change should also be reflected in this file.

### Testing conventions

New pure-logic functions (worker helpers, `src/lib/*`) and new auth/permission-sensitive endpoints should get a unit or integration test added in the same PR — written after the behavior is working and validated on a deploy preview, not TDD-style. UI/component changes don't require tests; keep validating those via deploy-preview click-through. Run `npm test` (frontend unit tests), `node --test tests/worker-unit.test.mjs` (backend pure-function unit tests), and — for auth/permissions/admin-owner changes specifically — the relevant `tests/*.test.mjs` integration test (e.g. `node tests/auth.test.mjs`, `node tests/admin-owner.test.mjs`, `node tests/signup-recovery.test.mjs`, `node tests/admin-delete-user.test.mjs`, `node tests/self-delete-account.test.mjs`, `node tests/feedback.test.mjs`) before merging.

## Deployment

Pure-function logic has unit test coverage, run in CI on every push/PR, no D1/wrangler needed. Auth, permissions, and other DB-backed behavior have integration tests (`tests/*.test.mjs`) that spin up the real Worker locally against local D1 via `wrangler dev --local` (see `tests/_helpers.mjs`) — intentionally **not** wired into CI (too slow/flaky to run on every push); run on demand via `npm run test:integration` or `node tests/<file>.test.mjs`. UI/component behavior has no automated coverage and is validated by deploying:
- Worker changes: push to `main` — Cloudflare's Git integration runs `npx wrangler deploy` automatically.
- Frontend changes (`src/`): push to `main` — Cloudflare Pages runs `npm run build` and deploys `dist/` automatically. `npm install && npm run build` can also be run wherever Node is available (including inside a Claude Code session) to validate a change before pushing; `npm run dev` runs Vite's local dev server (starts at `/app.html`).
- Schema changes: add a new numbered file in `migrations/`, then see "Applying migrations" below.

### Applying migrations without a local install

The developer doesn't install anything locally — everything goes through Claude Code or the Cloudflare web dashboard. Claude Code sessions on this repo generally have **no** `CLOUDFLARE_API_TOKEN`/`wrangler login` session, so `wrangler d1 migrations apply --remote` can't run from inside them.

**The `mcp__Cloudflare_Developer_Platform__d1_database_query` tool is allowed in `.claude/settings.json`**, so Claude can run SQL against production D1 directly without the user going to the Cloudflare dashboard. Use it to apply migrations and verify schema/data.

The preferred way to apply a migration against production:
1. Write the migration SQL file in `migrations/` as usual.
2. Run the SQL via `mcp__Cloudflare_Developer_Platform__d1_database_query` (Claude can do this in auto mode without prompting).
3. Also run `INSERT INTO d1_migrations (name, applied_at) VALUES ('00NN_filename.sql', datetime('now'));` so Wrangler's tracking table stays in sync.
4. Verify the result with a follow-up query via the same tool.
