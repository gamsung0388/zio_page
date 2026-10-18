CREATE TABLE song_import_jobs (
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  request_key TEXT NOT NULL CHECK (length(request_key) BETWEEN 16 AND 80),
  body_hash TEXT NOT NULL CHECK (length(body_hash) = 64),
  claim_token TEXT NOT NULL CHECK (length(claim_token) = 64),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (admin_user_id, request_key)
);
