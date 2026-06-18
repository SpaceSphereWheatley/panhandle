# Panhandle

A shared shopping list and meal planner PWA for two people, built on Cloudflare (Pages + Worker + D1).

**Live:** https://shopping.mohibb.com

## Features

- **Shopping list** with categories, autocomplete, and one-click checkout
- **Meal planning** for the next 14 days with assigned responsibility
- **Real-time sync** between two devices (polling every 7 seconds)
- **In-app password change** that logs out other devices
- **Sliding token expiry** — you stay logged in as long as the app is used
- **Installable** as a home-screen app on Android

## Architecture

- **Frontend:** Cloudflare Pages (static HTML/CSS/JS)
- **API:** Cloudflare Worker (handles `/api/*` and `/seed`)
- **Database:** Cloudflare D1 (SQLite)
- **Auth:** JWT with PBKDF2 password hashing, token versioning

## Setup

Both the Pages project and the Worker are connected directly to this GitHub repo via Cloudflare's native Git integration — push to `main` and both auto-deploy. No GitHub Actions, no manual file uploads.

- **Pages:** Connect to Git → this repo → branch `main` → build output directory `public/`, no build command.
- **Worker:** Connect to Git → this repo → branch `main` → deploy command `npx wrangler deploy` (reads `wrangler.toml` at repo root), no build command.
- **D1 database:** schema is applied manually — run the SQL in `migrations/` (in order) against the `panhandle` D1 database via the Cloudflare dashboard's D1 console. There's no migration runner.
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
  - `0001_init.sql` — shopping list and meal plan tables
  - `0002_users.sql` — user accounts with password hashing
  - `0003_list_items_qty_notes.sql` — qty + notes columns
  - `0004_seed_catalogue.sql` — 500 common Norwegian items
  - `0005_multi_tenant.sql` — per-list isolation + owner/admin flags
    (see `docs/multi-tenant-setup.md` for the rollout steps)

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
