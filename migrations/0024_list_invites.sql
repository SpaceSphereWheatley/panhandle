-- Shareable one-time invite links for adding a household member, replacing
-- the old flow where an owner typed a name+email and got a generated
-- password to relay by hand (POST /list-users, unchanged, just no longer
-- called from the Members settings UI). Only the SHA-256 hash of the raw
-- token is ever stored — same generate-raw/store-hash/single-lookup-and-
-- delete pattern as password_resets (0010_signup_and_recovery.sql) — so a
-- DB read alone can't be replayed as a working invite link. Generating an
-- invite writes only here; no `users` row is created until /invite-signup
-- or /invite-google redeems it. UNIQUE(list_id) makes "one active invite
-- per list, regenerating replaces the previous one" a DB guarantee via an
-- upsert rather than an app-level check-then-write.
-- Additive/expand-only, like every migration after 0001.
CREATE TABLE IF NOT EXISTS list_invites (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id    INTEGER NOT NULL REFERENCES lists(id),
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  UNIQUE(list_id)
);
CREATE INDEX IF NOT EXISTS idx_list_invites_token ON list_invites(token_hash);
