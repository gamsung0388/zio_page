import { DEFAULT_THEME, validateAppearance } from "../../shared/appearance.js";
const KEY = "appearance.v1";
function serialize(row) {
  if (!row) return { theme: DEFAULT_THEME, revision: 0, updated_at: null };
  const value = JSON.parse(row.value);
  const { theme } = validateAppearance({ theme: value.theme });
  if (!Number.isSafeInteger(value.revision) || value.revision < 1)
    throw Error("Invalid appearance revision");
  return { theme, revision: value.revision, updated_at: row.updated_at };
}
export async function getAppearance(db) {
  return serialize(
    await db
      .prepare("SELECT value,updated_at FROM site_settings WHERE key=?")
      .bind(KEY)
      .first(),
  );
}
export async function saveAppearance(db, appearance, revision) {
  const value = JSON.stringify({ ...appearance, revision: revision + 1 });
  const row =
    revision === 0
      ? await db
          .prepare(
            "INSERT INTO site_settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING RETURNING value,updated_at",
          )
          .bind(KEY, value)
          .first()
      : await db
          .prepare(
            "UPDATE site_settings SET value=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE key=? AND json_extract(value,'$.revision')=? RETURNING value,updated_at",
          )
          .bind(value, KEY, revision)
          .first();
  return row ? serialize(row) : null;
}
