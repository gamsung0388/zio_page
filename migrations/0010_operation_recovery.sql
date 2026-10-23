-- Recoverable content and credential-free operation history.
ALTER TABLE songs ADD COLUMN deleted_at TEXT;
ALTER TABLE songs ADD COLUMN updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE admin_schedule_events ADD COLUMN deleted_at TEXT;
ALTER TABLE admin_users ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admin_users ADD COLUMN status_updated_by INTEGER REFERENCES admin_users(id) ON DELETE SET NULL;
CREATE INDEX idx_songs_deleted ON songs(deleted_at,id);
CREATE INDEX idx_events_deleted ON admin_schedule_events(deleted_at,id);
CREATE TABLE operation_history (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL CHECK(entity_type IN ('song','event','admin')), entity_id INTEGER NOT NULL, action TEXT NOT NULL, title TEXT NOT NULL, actor_id INTEGER REFERENCES admin_users(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX idx_operation_history_entity ON operation_history(entity_type,id);
CREATE TRIGGER song_history_create AFTER INSERT ON songs BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('song',NEW.id,'create',NEW.title,NEW.updated_by); END;
CREATE TRIGGER song_history_change AFTER UPDATE ON songs WHEN NEW.revision<>OLD.revision BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('song',NEW.id,CASE WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'trash' WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'restore' ELSE 'update' END,NEW.title,NEW.updated_by); END;
CREATE TRIGGER song_history_purge AFTER DELETE ON songs WHEN OLD.deleted_at IS NOT NULL BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('song',OLD.id,'purge',OLD.title,OLD.updated_by); END;
CREATE TRIGGER event_history_create AFTER INSERT ON admin_schedule_events BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('event',NEW.id,'create',NEW.title,NEW.updated_by); END;
CREATE TRIGGER event_history_change AFTER UPDATE ON admin_schedule_events WHEN NEW.revision<>OLD.revision BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('event',NEW.id,CASE WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'trash' WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'restore' ELSE 'update' END,NEW.title,NEW.updated_by); END;
CREATE TRIGGER event_history_purge AFTER DELETE ON admin_schedule_events WHEN OLD.deleted_at IS NOT NULL BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('event',OLD.id,'purge',OLD.title,OLD.updated_by); END;
CREATE TRIGGER admin_history_status AFTER UPDATE ON admin_users WHEN NEW.is_active<>OLD.is_active BEGIN INSERT INTO operation_history(entity_type,entity_id,action,title,actor_id) VALUES('admin',NEW.id,CASE WHEN NEW.is_active=1 THEN 'activate' ELSE 'deactivate' END,NEW.username,NEW.status_updated_by); END;
