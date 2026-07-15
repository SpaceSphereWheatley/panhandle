# Panhandle

A shared shopping list and meal planner PWA for two people, built on Cloudflare (Pages + Worker + D1).

**Live:** https://shopping.mohibb.com

## Features

- **Shopping list** with categories, autocomplete, and one-click checkout
- **Meal planning** with a Monday–Sunday week view (navigate to any week) and assigned responsibility
- **Multi-tenant** — isolated per-household lists with independent owner/admin roles: admins create new lists, owners add/remove members (see `docs/multi-tenant-setup.md` for the original cutover history)
- **Self-service accounts** — sign up directly or with Google, recover a forgotten password by email, no admin required
- **Real-time sync** between devices (polling every 7 seconds)
- **In-app password change** that logs out other devices
- **Sliding token expiry** — you stay logged in as long as the app is used
- **Installable** as a home-screen app on Android/iOS

## Architecture

- **Frontend:** Vite + React, built to static assets and deployed on Cloudflare Pages (`src/`, built via `npm run build` to `dist/`)
- **API:** Cloudflare Worker (handles `/api/*` and `/seed`)
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** JWT with PBKDF2 password hashing, token versioning, plus self-service signup, "Sign in with Google", and email password recovery

## Setup

Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration — push to `main` and both auto-deploy. No GitHub Actions, no manual file uploads.

- **Pages:** Connect to Git → this repo → branch `main` → build command `npm run build`, output directory `dist`.
- **Worker:** Connect to Git → this repo → branch `main` → deploy command `npx wrangler deploy` (reads `wrangler.toml` at repo root), no build command.
- **D1 database:** schema/data changes live in `migrations/` and are applied with Wrangler's built-in D1 migrations runner: `npx wrangler d1 migrations apply panhandle --remote` (requires `wrangler login` or `CLOUDFLARE_API_TOKEN`). Wrangler records applied files in the `d1_migrations` table inside the DB, so only new numbered files run. This is a manual step a developer runs after merging a migration file — it is intentionally **not** wired into the Git integration/CI.
- **Worker secrets:** set directly in the Worker's dashboard (Settings → Variables and Secrets), independent of the Git integration — `JWT_SECRET`, `SEED_SECRET`, plus `RESEND_API_KEY`/`TURNSTILE_SECRET_KEY`/`FEEDBACK_EMAIL`/`SUPERADMIN_USERNAMES` for email, CAPTCHA, feedback, and superadmin features (see `CLAUDE.md`'s Deployment section for what each gates).

## Development

### Local testing
The real app lives in `src/` (a Vite + React build) — run `npm install && npm run dev` for a local dev server (starts at `/app.html`); it won't connect to the API without a running Worker. `public/index.html` is a separate static marketing/landing page, unrelated to the app itself. For full testing, you need the live Worker deployed.

### Deploying changes

Both halves deploy automatically on push to `main`:
- **Frontend (Pages):** edit files in `src/`, push — Cloudflare runs `npm run build` and deploys `dist/`.
- **API (Worker):** edit `worker/index.js`, push — Cloudflare runs `npx wrangler deploy` and deploys.

## Files

- `worker/index.js` — Cloudflare Worker (API + routing)
- `src/` — the live frontend (Vite + React), built to `dist/`
- `shared/` — small modules (`version.js`, `categories.js`) imported by both the Worker and the frontend, so version/category lists have one source of truth
- `public/` — static assets Vite copies verbatim into `dist/`
  - `index.html` — static marketing/landing page (unauthenticated, links to `/app.html`)
  - `seed.html` — one-time account creation page (posts to `/seed`, delete after setup)
  - `manifest.json` — PWA metadata
  - `icon-*.png` — app icons
- `migrations/` — D1 schema; `0001_init.sql` is the consolidated base schema, `0002`/`0003` seed the ~710-item catalogue, and later numbered files add suggestion stats, recurring schedules, and self-service signup/recovery — see `CLAUDE.md`'s Architecture section for the full breakdown
- `CHANGELOG.md` — released versions and what changed

## Known Limitations

- Sync is polling-based (every 7 seconds), not real-time push
- No offline mode (PWA requires network)
- No built-in backup (D1 is your source of truth)

## Future Ideas

- Add ingredients per meal, auto-push to list
- Service worker for offline support
- Custom categories (editable in-app)
- Expense tracking or note-taking

## License

Personal project. Feel free to fork and adapt for your own use.

---

**Made by:** Mohibb Malik, 2026
