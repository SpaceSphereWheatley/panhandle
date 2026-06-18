-- 0007_login_attempts.sql
-- Backing table for login rate-limiting (TODO #14): tracks failed /login
-- attempts per source IP so a sliding window can be checked/cleaned up
-- entirely in SQL, no separate KV/Rate Limiting binding needed.

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_login_attempts_ip_time ON login_attempts(ip, created_at);
