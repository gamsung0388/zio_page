CREATE TABLE site_navigation (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
