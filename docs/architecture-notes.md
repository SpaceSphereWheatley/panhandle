# Architecture notes (reference)

Detailed rationale and history for things summarized in `CLAUDE.md`. Not needed for every session — read this when you're actually touching one of these areas.

## Frontend rewrite history

The frontend was rewritten from a hand-rolled, no-build vanilla JS/HTML app to the current Vite + React build — this is now the live app. The old vanilla app (`public/app.html`, `public/itemIcons.js`, `public/uiIcons.js`) has been deleted: it was never served in production (the Vite build's own `dist/app.html` always overwrote the copied-through one), and its functionality was fully ported to `src/lib/itemIcons.js`/`src/lib/uiIcons.js` and Phosphor icons. `public/index.html` (a separate static marketing/landing page) and `public/manifest.json`/icons are unrelated to this rewrite and still served as-is via Vite's `publicDir` copy-through.

## Why the Vite entry is named `app.html`

The Vite entry is named `app.html` (not `index.html`) specifically so it builds to `dist/app.html`, matching the real app's URL (`shopping.mohibb.com/app.html`) and leaving `public/index.html`'s copy-through (via Vite's `publicDir`, still pointed at `public/`) untouched at `dist/index.html` instead of colliding with it.

## Migration-by-migration history

- `0001_init.sql` holds the full consolidated schema (lists, users, item_catalogue, list_items, meal_catalogue, meal_plan, login_attempts, and all indexes) — this project has exactly one deployment, so the original incremental migrations (users table, qty/notes columns, multi-tenant cutover, login-rate-limiting table) were squashed into it rather than kept as separate ordered steps.
- `0002_seed_catalogue.sql` and `0003_expand_catalogue.sql` are pure data seeds (non-destructive, re-runnable upserts that ensure 710 common Norwegian household items exist in every list's `item_catalogue`, overwriting an item's category on conflict; never wipe data) — both depend on `lists`/`list_id` from `0001_init.sql`, which is why they're numbered after it.
- `0004_meal_usage_stats.sql`/`0005_item_purchase_stats.sql` add durable, never-pruned counters (`meal_catalogue.times_planned`/`last_planned`, `item_catalogue.times_bought`/`first_bought`/`last_bought`) that power the suggestion endpoints (see Data flow in `CLAUDE.md`).
- `0006_meal_labels.sql` adds `meal_catalogue.labels`.
- `0007_recurring_schedule.sql` adds the `recurring_schedule` table.
- `0008_meal_plan_nullable_meal.sql`/`0009_meal_plan_set_null.sql` make `meal_plan.meal_id` nullable and change its FK from `ON DELETE CASCADE` to `ON DELETE SET NULL`, so deleting a catalogue meal unassigns it from planned days instead of deleting the whole plan-day row.
- `0010_signup_and_recovery.sql` adds `users.email`/`google_sub`, `lists.name`, and the `password_resets`/`rate_limit_attempts` tables backing self-service signup/Google sign-in/password recovery.
- `0011_user_display_name.sql` adds `users.name` (a display name, separate from username/e-mail).
- `0012_push_notifications.sql` adds `push_subscriptions`, `notification_settings`, and `notification_log` (see Push notifications in `CLAUDE.md`).
- `0014_notification_phase2.sql` adds `notification_settings.weekly_reminder_enabled`/`weekly_reminder_time` and the `notification_state` table (see Push notifications in `CLAUDE.md`).
- `0015_stale_item_marker.sql` adds `notification_settings.stale_item_days` — the per-list threshold for the shopping list's client-side "stale item" marker.
- `0016_important_item_marker.sql` adds `list_items.important` — the per-line, this-trip importance flag toggled from the item card.
- `0017_category_order.sql` adds the `category_order` table (one row per `list_id`+`category`, with a `position`) — the per-list custom aisle order (TODO #105). Additive/expand-only; a list with no rows falls back to the canonical `CATEGORIES` order via `normalizeCategoryOrder` (see Categories and people in `CLAUDE.md`).
- `0018_catalogue_sync_state.sql` adds `catalogue_sync_state`, a single-row table backing the cron-driven `checkCatalogueSync` (see Catalogue sync in `CLAUDE.md`), which replaced `0002`/`0003`'s pattern of a hand-written one-off migration every time a common item was added — new items now only need adding to `COMMON_ITEMS` and a deploy.

## Auth: extra detail

- `POST /admin/owners` and `POST /list-users` (owner-only, adds a plain member) require an e-mail + name — every account has one, no exception.
- There used to be a one-time, secret-gated `/seed` endpoint for bootstrapping the very first account — removed once self-service signup made it unnecessary; if you find references to it elsewhere, they're stale.
- Google sign-in seeds `name`/`email` from the ID token's claims once (new account, or first-time linking an existing e-mail/password account) and never overwrites a later local edit on subsequent sign-ins.

## `changelog.html` vs `ChangelogModal`

`public/changelog.html` fetches `/CHANGELOG.md` and renders the full history (all versions, full bullet text, not just titles) — it's the "full changelog" destination for both the landing page footer and `ChangelogModal`'s "Se hele endringsloggen" link. This is deliberately a same-origin static page rather than a link out to GitHub: the landing page is the product's public face, and routing off-domain to GitHub would leak an implementation detail (and break if the repo ever went private). `ChangelogModal` itself only shows compact per-version titles (`src/lib/changelogUtils.js`'s `parseChangelog`) — full text lives only on `/changelog.html`, whose own markdown rendering is a small hand-rolled parser (not `parseChangelog`, since `public/` has no build step and can't import from `src/`) tailored to this file's actual shapes (headings, one level of nested bullets, wrapped continuation lines) rather than being general-purpose.
