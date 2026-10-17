import { defaultNavigation } from "../../shared/navigation.js";
function serialize(row) {
  return row
    ? {
        items: JSON.parse(row.payload),
        revision: row.revision,
        updated_at: row.updated_at,
      }
    : { items: defaultNavigation(), revision: 0, updated_at: null };
}
export async function getNavigation(db) {
  return serialize(
    await db
      .prepare(
        "SELECT payload,revision,updated_at FROM site_navigation WHERE id=1",
      )
      .first(),
  );
}
export async function saveNavigation(db, items, revision, userId) {
  const payload = JSON.stringify(items);
  const row =
    revision === 0
      ? await db
          .prepare(
            "INSERT INTO site_navigation (id,payload,updated_by) VALUES (1,?,?) ON CONFLICT(id) DO NOTHING RETURNING payload,revision,updated_at",
          )
          .bind(payload, userId)
          .first()
      : await db
          .prepare(
            "UPDATE site_navigation SET payload=?,revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=1 AND revision=? RETURNING payload,revision,updated_at",
          )
          .bind(payload, userId, revision)
          .first();
  return row ? serialize(row) : null;
}
