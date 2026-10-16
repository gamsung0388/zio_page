import { ApiError, json, readJson } from "../utils/http.js";
import {
  validateWeek,
  validateRange,
  validateSchedule,
} from "../services/schedule-validation.js";
import {
  getWeek,
  listWeeks,
  saveWeek,
  backupWeeks,
} from "../repositories/schedules.js";
// Called only after the existing admin session, forced-password and CSRF checks.
export async function scheduleRoutes(request, env, path, auth) {
  if (path === "/api/admin/schedules/backup" && request.method === "GET") {
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some((key) => key !== "after") ||
      params.getAll("after").length > 1
    )
      throw new ApiError(
        400,
        "SCHEDULE_BACKUP",
        "백업 조회 조건을 확인해주세요.",
      );
    const after = params.get("after");
    if (after !== null) validateWeek(after);
    return json(await backupWeeks(env.DB, after));
  }
  if (path === "/api/admin/schedules" && request.method === "GET") {
    const { from, to } = validateRange(new URL(request.url).searchParams);
    return json({ items: await listWeeks(env.DB, from, to) });
  }
  const match = path.match(/^\/api\/admin\/schedules\/(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  const week = validateWeek(match[1]);
  if (request.method === "GET") return json(await getWeek(env.DB, week));
  if (request.method === "PUT") {
    const { payload, expected_revision } = validateSchedule(
      await readJson(request),
    );
    const saved = await saveWeek(
      env.DB,
      week,
      payload,
      expected_revision,
      auth.user.id,
    );
    if (!saved)
      throw new ApiError(
        409,
        "SCHEDULE_CONFLICT",
        "다른 관리자가 이 주를 변경했습니다. 입력 내용을 확인한 뒤 서버에서 다시 불러와주세요.",
      );
    return json(saved, expected_revision === 0 ? 201 : 200);
  }
  return null;
}
