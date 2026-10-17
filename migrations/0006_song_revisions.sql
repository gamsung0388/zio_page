-- Existing songs start at revision 1; public APIs and CSV columns stay unchanged.
ALTER TABLE songs ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1);
