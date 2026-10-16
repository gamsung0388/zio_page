-- Private, week-based schedule documents. No changes to songs or administrator credentials.
CREATE TABLE admin_schedule_weeks (
 week_start TEXT PRIMARY KEY NOT NULL,
 payload TEXT NOT NULL CHECK (json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
 updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
