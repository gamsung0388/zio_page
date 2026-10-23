import { eventFromRow } from "../../shared/schedule/events.js";
const COLUMNS =
  "id,title,description,kind,time_mode,starts_at,ends_at,revision,created_at,updated_at";
export async function getEvent(db, id) {
  return eventFromRow(
    await db
      .prepare(
        "SELECT " +
          COLUMNS +
          " FROM admin_schedule_events WHERE deleted_at IS NULL AND id=?",
      )
      .bind(id)
      .first(),
  );
}
export async function listEvents(db, { from, to, kind, page, page_size }) {
  const where = ["deleted_at IS NULL", "starts_at < ?", "ends_at > ?"],
    args = [to, from];
  if (kind) {
    where.push("kind=?");
    args.push(kind);
  }
  const condition = where.join(" AND ");
  const [rows, count] = await db.batch([
    db
      .prepare(
        "SELECT " +
          COLUMNS +
          " FROM admin_schedule_events WHERE " +
          condition +
          " ORDER BY starts_at,id LIMIT ? OFFSET ?",
      )
      .bind(...args, page_size, (page - 1) * page_size),
    db
      .prepare(
        "SELECT COUNT(*) total FROM admin_schedule_events WHERE " + condition,
      )
      .bind(...args),
  ]);
  return {
    items: rows.results.map(eventFromRow),
    pagination: { page, page_size, total: count.results[0].total },
  };
}
export async function createEvent(db, event, userId) {
  return eventFromRow(
    await db
      .prepare(
        "INSERT INTO admin_schedule_events (title,description,kind,time_mode,starts_at,ends_at,updated_by) VALUES (?,?,?,?,?,?,?) RETURNING " +
          COLUMNS,
      )
      .bind(
        event.title,
        event.description,
        event.kind,
        event.time_mode,
        event.starts_at,
        event.ends_at,
        userId,
      )
      .first(),
  );
}
export async function updateEvent(db, id, event, revision, userId) {
  return eventFromRow(
    await db
      .prepare(
        "UPDATE admin_schedule_events SET title=?,description=?,kind=?,time_mode=?,starts_at=?,ends_at=?,revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE deleted_at IS NULL AND id=? AND revision=? RETURNING " +
          COLUMNS,
      )
      .bind(
        event.title,
        event.description,
        event.kind,
        event.time_mode,
        event.starts_at,
        event.ends_at,
        userId,
        id,
        revision,
      )
      .first(),
  );
}
export async function deleteEvent(db, id, revision, actor = null) {
  return db
    .prepare(
      "UPDATE admin_schedule_events SET deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revision=revision+1,updated_by=? WHERE deleted_at IS NULL AND id=? AND revision=? RETURNING id",
    )
    .bind(actor, id, revision)
    .first();
}
export async function backupEvents(db, after) {
  const rows = (
    await db
      .prepare(
        "SELECT " +
          COLUMNS +
          " FROM admin_schedule_events WHERE deleted_at IS NULL AND id>? ORDER BY id LIMIT 201",
      )
      .bind(after)
      .all()
  ).results;
  return {
    items: rows.slice(0, 200).map(eventFromRow),
    next_after: rows.length > 200 ? rows[199].id : null,
  };
}
