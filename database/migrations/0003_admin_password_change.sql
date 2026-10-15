-- Reset passwords must be changed before any administrative operation.
ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0
  CHECK (must_change_password IN (0,1));
