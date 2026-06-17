# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Panhandle: a shared shopping list + meal planner PWA for two people, deployed entirely on Cloudflare (Pages + Worker + D1). Live at https://shopping.mohibb.com.

There is no build step and no Node toolchain in this repo. Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration (not GitHub Actions) — pushing to `main` auto-deploys both. Do not introduce bundlers, package.json, or frameworks unless explicitly asked.

## Architecture

- **`worker/index.js`** — single-file Cloudflare Worker. Handles all `/api/*` and `/seed` routes, and proxies any non-API request to the Pages project (hostname hardcoded near `pagesUrl.hostname`, currently `panhandle-ecj.pages.dev`). This is the entire backend: routing, auth, and business logic all live in one `fetch` handler with sequential `if (path === ...)` checks.
- **`public/`** — static frontend served by Cloudflare Pages (no framework, no build): `index.html` (the app, single file with inline `<style>`/`<script>`), `seed.html` (one-time account creation form, posts to `/seed`), `manifest.json`, icons. Pages build output directory is `public/`, no build command.
- **`migrations/`** — SQL run manually in the D1 console, in order: `0001_init.sql` (shopping list + meal tables), `0002_users.sql` (users table), `0003_list_items_qty_notes.sql` (qty + notes columns), `0004_seed_catalogue.sql` (wipes + reseeds `item_catalogue` with 500 common Norwegian household items). There is no migration runner; new schema/data changes need a new numbered `.sql` file and manual execution against D1.

### Deployment (Cloudflare Git integration)

- Both the Pages project and the Worker are configured in the Cloudflare dashboard to track `main` directly — no `.github/workflows/` exist in this repo.
- Worker deploy command (set in Cloudflare dashboard): `npx wrangler deploy`, reading `wrangler.toml` at repo root.
- Worker runtime secrets (`JWT_SECRET`, `SEED_SECRET`) are set in the Worker's dashboard (Settings → Variables and Secrets) and are independent of the Git integration — they persist across deploys and are never defined in `wrangler.toml` or committed to the repo.

### Auth model (worker/index.js)

- Passwords: PBKDF2 (100k iterations, SHA-256) via Web Crypto, no external deps — see `hashPassword`/`verifyPassword`.
- Tokens: hand-rolled HS256 JWT (`signJwt`/`verifyJwt`), signed with `env.JWT_SECRET`.
- Every JWT carries `tv` (token_version). `requireAuth` checks the JWT against the DB's current `token_version` for that user — changing a password bumps `token_version`, which invalidates all other devices' tokens immediately even though those tokens haven't expired.
- Sliding expiry: every authenticated response includes a fresh token in the `X-Refresh-Token` header (see `mintToken`, used for `/list` and the post-auth flow). The frontend (`public/index.html`) reads this header in its `api()` wrapper and re-stores the token, except on `/change-password` (whose response body — not header — carries the authoritative new-version token).
- `/seed` is a one-time, secret-gated endpoint (`env.SEED_SECRET`) for creating the two user accounts; it's meant to be disabled (remove the secret from Cloudflare) after first use.

### Data flow

- Shopping items reference a shared `item_catalogue` (name + category) so a name typed once is remembered with its category afterward; `list_items` just tracks bought/added-by state against a catalogue entry.
- Meals follow the same pattern: `meal_catalogue` holds known meal names, `meal_plan` assigns one meal + a responsible person to a given `plan_date` (one row per date, upserted via `ON CONFLICT(plan_date)`).
- Frontend polls `/list` and `/plan` every 7 seconds while the relevant tab is active (no websockets/push).

### Categories and people

`CATEGORIES` is duplicated in both `worker/index.js` (server-side validation/default) and `public/index.html` (display grouping) — keep them in sync if changed. `PEOPLE` (`["Mohibb", "Saffa"]`) only exists client-side in `public/index.html`.

## Deployment

There is no local dev server or test suite. Changes are validated by deploying:
- Worker changes: push to `main` — Cloudflare's Git integration runs `npx wrangler deploy` automatically.
- Frontend changes: push to `main` — Cloudflare Pages rebuilds `public/` automatically.
- Schema changes: run the new/changed SQL manually in the D1 console; there's no automated migration application.
