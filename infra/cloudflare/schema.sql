CREATE TABLE IF NOT EXISTS votes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  page      TEXT    NOT NULL,
  direction TEXT    NOT NULL CHECK (direction IN ('up', 'down')),
  ip_hash   TEXT    NOT NULL,
  voted_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_votes_page    ON votes (page);
CREATE INDEX IF NOT EXISTS idx_votes_ip_page ON votes (ip_hash, page);
