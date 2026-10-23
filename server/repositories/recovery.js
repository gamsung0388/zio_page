const tables = { songs: "songs", events: "admin_schedule_events" };
export async function recoveryList(db, type, page) {
  const table = tables[type];
  if (!table) throw Error("Invalid recovery type");
  const [rows, count] = await db.batch([
    db
      .prepare(
        `SELECT id,title,revision,deleted_at${type === "songs" ? ",artist" : ""} FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC,id DESC LIMIT 20 OFFSET ?`,
      )
      .bind((page - 1) * 20),
    db.prepare(
      `SELECT COUNT(*) total FROM ${table} WHERE deleted_at IS NOT NULL`,
    ),
  ]);
  return {
    items: rows.results,
    pagination: { page, page_size: 20, total: count.results[0].total },
  };
}
export async function restoreContent(db, type, id, revision, actor) {
  const table = tables[type];
  if (!table) throw Error("Invalid recovery type");
  return db
    .prepare(
      `UPDATE ${table} SET deleted_at=NULL,revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')${type === "songs" ? ",is_public=0" : ""} WHERE id=? AND revision=? AND deleted_at IS NOT NULL RETURNING id`,
    )
    .bind(actor, id, revision)
    .first();
}
export async function purgeContent(db, type, id, revision, actor) {
  const table = tables[type];
  if (!table) throw Error("Invalid recovery type");
  const results = await db.batch([
    db
      .prepare(
        `UPDATE ${table} SET updated_by=? WHERE id=? AND revision=? AND deleted_at IS NOT NULL`,
      )
      .bind(actor, id, revision),
    db
      .prepare(
        `DELETE FROM ${table} WHERE id=? AND revision=? AND deleted_at IS NOT NULL RETURNING id`,
      )
      .bind(id, revision),
  ]);
  return results[1].results[0] || null;
}
export async function historyList(db, page) {
  const [rows, count] = await db.batch([
    db
      .prepare(
        "SELECT h.id,h.entity_type,h.entity_id,h.action,h.title,h.created_at,u.display_name actor FROM operation_history h LEFT JOIN admin_users u ON u.id=h.actor_id ORDER BY h.id DESC LIMIT 20 OFFSET ?",
      )
      .bind((page - 1) * 20),
    db.prepare("SELECT COUNT(*) total FROM operation_history"),
  ]);
  return {
    items: rows.results,
    pagination: { page, page_size: 20, total: count.results[0].total },
  };
}
