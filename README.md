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

See [SETUP.md](SETUP.md) for complete deployment instructions. You'll need:
- A Cloudflare account
- A custom domain (or subdomain)
- ~15 minutes

## Development

### Local testing
Frontend code can be tested locally by opening `public/index.html` in a browser (won't connect to the API without a running Worker). For full testing, you need the live Worker deployed.

### Deploying changes

**Frontend (Pages):**
1. Edit files in `public/`
2. Push to GitHub
3. Pages auto-deploys (if linked via GitHub integration)

**API (Worker):**
1. Edit `worker/index.js`
2. Push to GitHub
3. GitHub Actions auto-deploys via `wrangler deploy` (requires secrets configured in GitHub)

To deploy Worker manually without GitHub Actions:
1. Go to Worker → **Edit code**
2. Paste the updated `worker/index.js`
3. Click **Deploy**

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
- `SETUP.md` — deployment guide
- `.github/workflows/deploy.yml` — GitHub Actions for Worker auto-deploy

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
