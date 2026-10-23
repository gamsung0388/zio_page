export async function readSetting(db, key) {
  return db
    .prepare("SELECT value,updated_at FROM site_settings WHERE key=?")
    .bind(key)
    .first();
}
export async function writeSetting(db, key, payload, revision) {
  const value = JSON.stringify({ ...payload, revision: revision + 1 });
  return revision === 0
    ? db
        .prepare(
          "INSERT INTO site_settings(key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING RETURNING value,updated_at",
        )
        .bind(key, value)
        .first()
    : db
        .prepare(
          "UPDATE site_settings SET value=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key=? AND json_extract(value,'$.revision')=? RETURNING value,updated_at",
        )
        .bind(value, key, revision)
        .first();
}
