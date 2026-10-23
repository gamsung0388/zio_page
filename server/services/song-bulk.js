import { validateSong } from "./song-validation.js";
import { ApiError } from "../utils/http.js";
const allowed = ["proficiency", "practice_status", "balloon_cost", "is_public"];
export function validateBulk(input) {
  if (
    Object.keys(input).some((k) => !["items", "changes"].includes(k)) ||
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 20 ||
    !input.changes ||
    typeof input.changes !== "object" ||
    Array.isArray(input.changes) ||
    Object.keys(input.changes).some((k) => !allowed.includes(k))
  )
    throw new ApiError(
      422,
      "BULK_INPUT",
      "한 번에 1~20곡의 숙련도·연습 상태·풍·공개 여부를 변경할 수 있어요.",
    );
  if (
    input.items.some(
      (row) =>
        !row ||
        Object.keys(row).some(
          (k) => !["id", "expected_revision"].includes(k),
        ) ||
        !Number.isSafeInteger(row.id) ||
        row.id < 1 ||
        !Number.isSafeInteger(row.expected_revision) ||
        row.expected_revision < 1,
    ) ||
    new Set(input.items.map((row) => row.id)).size !== input.items.length
  )
    throw new ApiError(422, "BULK_INPUT", "선택한 곡과 버전을 확인해주세요.");
  return { items: input.items, changes: validateSong(input.changes, true) };
}
export async function bulkSongs(db, { items, changes }, actor) {
  const fields = Object.keys(changes);
  const results = await db.batch(
    items.map((row) =>
      db
        .prepare(
          `UPDATE songs SET ${fields.map((field) => field + "=?").join(",")},revision=revision+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND revision=? AND deleted_at IS NULL RETURNING id`,
        )
        .bind(
          ...fields.map((field) =>
            field === "is_public" ? Number(changes[field]) : changes[field],
          ),
          actor,
          row.id,
          row.expected_revision,
        ),
    ),
  );
  return {
    applied: items
      .filter((_, i) => results[i].results.length)
      .map((row) => row.id),
    conflicted: items
      .filter((_, i) => !results[i].results.length)
      .map((row) => row.id),
  };
}
