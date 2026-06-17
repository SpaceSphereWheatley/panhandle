CREATE TABLE IF NOT EXISTS users (
  username      TEXT PRIMARY KEY COLLATE NOCASE,
  pass_hash     TEXT NOT NULL,
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
