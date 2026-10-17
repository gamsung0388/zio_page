-- Individual, administrator-only events. Existing weekly image notes are preserved.
CREATE TABLE IF NOT EXISTS admin_schedule_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 120),
 description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=2000),
 kind TEXT NOT NULL CHECK(kind IN ('broadcast','collab','off','personal','other')),
 time_mode TEXT NOT NULL CHECK(time_mode IN ('timed','all_day','undecided')),
 starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL CHECK(ends_at>starts_at),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_schedule_events_start ON admin_schedule_events(starts_at,id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_end ON admin_schedule_events(ends_at);
