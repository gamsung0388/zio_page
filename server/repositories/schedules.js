import { DEFAULT_TEMPLATE } from "../../shared/schedule/scheduleConfig.js";
import {
  createEditorOptions,
  createScheduleForm,
} from "../../shared/schedule/scheduleFactory.js";
export function emptyWeek(week_start) {
  return {
    week_start,
    revision: 0,
    updated_at: null,
    selectedTemplate: DEFAULT_TEMPLATE,
    scheduleForm: createScheduleForm(),
    editorOptions: createEditorOptions(),
  };
}
function serialize(row) {
  return row
    ? {
        ...JSON.parse(row.payload),
        week_start: row.week_start,
        revision: row.revision,
        updated_at: row.updated_at,
      }
    : null;
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
        "SELECT week_start,payload,revision,updated_at FROM admin_schedule_weeks WHERE week_start BETWEEN ? AND ? ORDER BY week_start LIMIT 10",
      )
      .bind(from, to)
      .all()
  ).results.map(serialize);
}
export async function backupWeeks(db, after) {
  const rows = (
    await db
      .prepare(
        "SELECT week_start,payload,revision,updated_at FROM admin_schedule_weeks WHERE week_start > ? ORDER BY week_start LIMIT 51",
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
