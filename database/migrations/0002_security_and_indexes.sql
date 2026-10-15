-- Persistent login throttling shared across Worker isolates. No cron or paid binding.
CREATE TABLE login_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_login_limits_expiry ON login_limits(expires_at);
CREATE INDEX idx_songs_title_artist ON songs(title COLLATE NOCASE, artist COLLATE NOCASE);
CREATE INDEX idx_songs_balloon ON songs(is_public, balloon_cost);
