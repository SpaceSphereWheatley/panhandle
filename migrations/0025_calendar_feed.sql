-- Per-user subscribable ICS calendar feed of the household meal plan.
-- Lives on `users` rather than a new table, following this project's
-- convention of additive ALTER TABLE for 1:1 per-user data (see
-- email/google_sub/name added in 0010/0011) — one feed per user, not per
-- device or per list.
--
-- Unlike list_invites, this is a *standing* subscription a calendar client
-- polls indefinitely, not a one-time redemption: no expires_at, and the
-- lookup route never deletes the row. Only the SHA-256 hash of the raw
-- token is stored (same generate-raw/store-hash pattern as
-- list_invites/password_resets) so a DB read alone can't be replayed as a
-- working feed URL.
--
-- ics_token_hash and ics_scope are deliberately independent: flipping scope
-- must NOT rotate the token, or every calendar app already subscribed to it
-- (which cache/poll slowly, on the order of hours) would silently start
-- 404ing until the user re-subscribes. Token regenerate
-- (POST /calendar-feed/token) and scope update (POST /calendar-feed) are
-- separate endpoints/writes for exactly this reason.
--
-- No UNIQUE/upsert needed here (unlike list_invites' UNIQUE(list_id)) —
-- username is already the users PK, so generate/revoke are plain UPDATEs.
ALTER TABLE users ADD COLUMN ics_token_hash TEXT;
ALTER TABLE users ADD COLUMN ics_scope TEXT NOT NULL DEFAULT 'all' CHECK(ics_scope IN ('all','mine'));

-- Only rows with a token need to be found by hash; most users never
-- generate one, so a partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_users_ics_token_hash ON users(ics_token_hash) WHERE ics_token_hash IS NOT NULL;
