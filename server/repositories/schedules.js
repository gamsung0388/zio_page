import { DEFAULT_TEMPLATE } from "../../shared/schedule/scheduleConfig.js";
import {
  createEditorOptions,
  createScheduleForm,
} from "../../shared/schedule/scheduleFactory.js";
export function emptyWeek(week_start) {
  return {
    week_start,
    revision: 0,
    is_saved: false,
    updated_at: null,
    selectedTemplate: DEFAULT_TEMPLATE,
    scheduleForm: createScheduleForm(),
    editorOptions: createEditorOptions(),
  };
}
function serialize(row) {
  if (!row) return null;
  const payload = JSON.parse(row.payload);
  if (payload._deleted === true)
    return { ...emptyWeek(row.week_start), revision: row.revision };
  return {
    ...payload,
    week_start: row.week_start,
    revision: row.revision,
    updated_at: row.updated_at,
    is_saved: true,
  };
}
export async function getWeek(db, date) {
  return (
    serialize(
      await db
        .prepare(
          "SELECT week_start,payload,revision,updated_at FROM admin_schedule_weeks WHERE week_start=?",
        )
        .bind(date)
        .first(),
    ) || emptyWeek(date)
  );
}
export async function listWeeks(db, from, to) {
  return (
    await db
      .prepare(
        "SELECT week_start,payload,revision,updated_at FROM admin_schedule_weeks WHERE week_start BETWEEN ? AND ? AND json_extract(payload, '$._deleted') IS NOT 1 ORDER BY week_start LIMIT 10",
      )
      .bind(from, to)
      .all()
  ).results.map(serialize);
}
export async function backupWeeks(db, after) {
  const rows = (
    await db
      .prepare(
        "SELECT week_start,payload,revision,updated_at FROM admin_schedule_weeks WHERE week_start > ? AND json_extract(payload, '$._deleted') IS NOT 1 ORDER BY week_start LIMIT 51",
      )
      .bind(after || "")
      .all()
  ).results;
  return {
    items: rows.slice(0, 50).map(serialize),
    next_after: rows.length > 50 ? rows[49].week_start : null,
  };
}
export async function saveWeek(db, date, payload, expected, userId) {
  const row =
    expected === 0
      ? await db
          .prepare(
            "INSERT INTO admin_schedule_weeks (week_start,payload,updated_by) VALUES (?,?,?) ON CONFLICT(week_start) DO NOTHING RETURNING *",
          )
          .bind(date, JSON.stringify(payload), userId)
          .first()
      : await db
          .prepare(
            "UPDATE admin_schedule_weeks SET payload=?,revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE week_start=? AND revision=? RETURNING *",
          )
          .bind(JSON.stringify(payload), userId, date, expected)
          .first();
  return serialize(row);
}

// Erase all content while retaining the version, so old editors cannot recreate or delete a newer save.
export async function deleteWeek(db, date, expected, userId) {
  const row = await db
    .prepare(
      "UPDATE admin_schedule_weeks SET payload=?,revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE week_start=? AND revision=? AND json_extract(payload, '$._deleted') IS NOT 1 RETURNING week_start,revision",
    )
    .bind(JSON.stringify({ _deleted: true }), userId, date, expected)
    .first();
  return row ? { ...emptyWeek(row.week_start), revision: row.revision } : null;
}
