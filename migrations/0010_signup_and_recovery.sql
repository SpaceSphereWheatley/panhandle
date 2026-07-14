-- Self-service signup (open public registration + "Sign in with Google") and
-- email-based password recovery. Accounts created via /seed, /admin/owners,
-- or /list-users have no email/google_sub on file and keep using the
-- existing admin-reset-password path.

ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;

-- Google's stable per-account subject id. Preferred link key over email
-- (email can change on the Google side); nullable since password-only
-- accounts never set it.
ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub) WHERE google_sub IS NOT NULL;

-- Optional household display name, settable at self-service signup. Lists
-- created via /seed or /admin/owners stay NULL.
ALTER TABLE lists ADD COLUMN name TEXT;

-- Single-use, short-lived password reset tokens. Only the SHA-256 hash of
-- the raw token is stored, so a DB read alone can't be replayed as a working
-- reset link.
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_username ON password_resets(username);

-- Generic IP-keyed abuse counter for the new public endpoints, shared across
-- /register and /forgot-password via a `kind` discriminator (same
-- delete-expired-then-count pattern as login_attempts) so each gets its own
-- independent window/threshold without a near-duplicate table per endpoint.
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_kind_ip_time ON rate_limit_attempts(kind, ip, created_at);
