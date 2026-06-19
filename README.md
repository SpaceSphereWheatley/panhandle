# Panhandle

A shared shopping list and meal planner PWA for two people, built on Cloudflare (Pages + Worker + D1).

**Live:** https://shopping.mohibb.com

## Features

- **Shopping list** with categories, autocomplete, and one-click checkout
- **Meal planning** with a Monday–Sunday week view (navigate to any week) and assigned responsibility
- **Multi-tenant** — isolated per-household lists with independent owner/admin roles: admins create new lists, owners add/remove members (see `docs/multi-tenant-setup.md`)
- **Real-time sync** between devices (polling every 7 seconds)
- **In-app password change** that logs out other devices
- **Sliding token expiry** — you stay logged in as long as the app is used
- **Installable** as a home-screen app on Android/iOS

## Architecture

- **Frontend:** Cloudflare Pages (static HTML/CSS/JS)
- **API:** Cloudflare Worker (handles `/api/*` and `/seed`)
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** JWT with PBKDF2 password hashing, token versioning

## Setup

Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration — push to `main` and both auto-deploy. No GitHub Actions, no manual file uploads.

- **Pages:** Connect to Git → this repo → branch `main` → build output directory `public/`, no build command.
- **Worker:** Connect to Git → this repo → branch `main` → deploy command `npx wrangler deploy` (reads `wrangler.toml` at repo root), no build command.
- **D1 database:** schema/data changes live in `migrations/` and are applied with Wrangler's built-in D1 migrations runner: `npx wrangler d1 migrations apply panhandle --remote` (requires `wrangler login` or `CLOUDFLARE_API_TOKEN`). Wrangler records applied files in the `d1_migrations` table inside the DB, so only new numbered files run. This is a manual step a developer runs after merging a migration file — it is intentionally **not** wired into the Git integration/CI.
- **Worker secrets:** `JWT_SECRET` and `SEED_SECRET` are set directly in the Worker's dashboard (Settings → Variables and Secrets) — independent of the Git integration.

## Development

### Local testing
Frontend code can be tested locally by opening `public/index.html` in a browser (won't connect to the API without a running Worker). For full testing, you need the live Worker deployed.

### Deploying changes

Both halves deploy automatically on push to `main`:
- **Frontend (Pages):** edit files in `public/`, push — Pages rebuilds and deploys.
- **API (Worker):** edit `worker/index.js`, push — Cloudflare runs `npx wrangler deploy` and deploys.

## Files

- `worker/index.js` — Cloudflare Worker (API + routing)
- `public/` — Frontend assets
  - `index.html` — main app
  - `seed.html` — one-time account creation page (delete after setup)
  - `manifest.json` — PWA metadata
  - `icon-*.png` — app icons
- `migrations/` — D1 schema
  - `0001_init.sql` — consolidated schema: shopping list, meal plan, users,
    multi-tenant isolation (`lists`, owner/admin flags), login rate-limiting
    (see `docs/multi-tenant-setup.md` for the multi-tenant rollout history)
  - `0002_seed_catalogue.sql` — ~500 common Norwegian items (non-destructive upsert)
  - `0003_expand_catalogue.sql` — +200 more catalogue items (~706 total)
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
