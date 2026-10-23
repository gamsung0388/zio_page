-- Optional provider metadata. Existing CSV columns and song values remain unchanged.
ALTER TABLE songs ADD COLUMN album TEXT NOT NULL DEFAULT 'null' CHECK (json_valid(album));
CREATE TABLE catalog_cache (cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK (json_valid(payload)), expires_at INTEGER NOT NULL);
CREATE TABLE catalog_limits (id INTEGER PRIMARY KEY CHECK(id=1), window_start INTEGER NOT NULL, requests INTEGER NOT NULL);
