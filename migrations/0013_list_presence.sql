-- "Who else has the shopping list open right now" heartbeat, driven by the
-- same 7s poll the shopping list already uses (see POST /presence). One row
-- per (list, user), overwritten on every poll rather than accumulated, so
-- the table never grows past a list's 10-user cap and needs no pruning —
-- staleness is judged purely by last_seen at query time.
CREATE TABLE IF NOT EXISTS list_presence (
  list_id   INTEGER NOT NULL REFERENCES lists(id),
  username  TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  PRIMARY KEY (list_id, username)
);
