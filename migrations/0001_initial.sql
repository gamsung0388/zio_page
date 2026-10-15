-- ZIO HOME v1 schema — Cloudflare D1 / SQLite
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  artist TEXT NOT NULL CHECK (length(trim(artist)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  genre TEXT NOT NULL DEFAULT '' CHECK (length(genre) <= 60),
  language TEXT NOT NULL DEFAULT '' CHECK (length(language) <= 40),
  proficiency INTEGER NOT NULL DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 5),
  practice_status TEXT NOT NULL DEFAULT 'not_started' CHECK (practice_status IN ('not_started','practicing','completed','on_hold')),
  balloon_cost INTEGER NOT NULL DEFAULT 0 CHECK (balloon_cost >= 0),
  memo TEXT NOT NULL DEFAULT '' CHECK (length(memo) <= 3000),
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_songs_public_created ON songs(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_songs_public_title ON songs(is_public, title COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_songs_public_artist ON songs(is_public, artist COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_songs_proficiency ON songs(is_public, proficiency);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(is_public, practice_status);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_user_id);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
