import { ApiError, json, readJson } from "../utils/http.js";
import {
  validateEvent,
  validateEventRange,
  validateEventRevision,
} from "../services/event-validation.js";
import {
  getEvent,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  backupEvents,
} from "../repositories/schedule-events.js";
function conflict() {
  throw new ApiError(
    409,
    "EVENT_CONFLICT",
    "이 일정이 다른 곳에서 변경되거나 삭제됐어요. 초안을 보관한 뒤 저장된 일정을 다시 확인해주세요.",
  );
}
export async function eventRoutes(request, env, path, auth) {
  if (
    path === "/api/admin/schedule-events/backup" &&
    request.method === "GET"
  ) {
    const params = new URL(request.url).searchParams,
      after = params.get("after");
    if (
      [...params.keys()].some((key) => key !== "after") ||
      params.getAll("after").length > 1 ||
      (after !== null &&
        (!/^[1-9]\d*$/.test(after) || !Number.isSafeInteger(Number(after))))
    )
      throw new ApiError(400, "EVENT_BACKUP", "백업 조회 조건을 확인해주세요.");
    return json(await backupEvents(env.DB, after === null ? 0 : Number(after)));
  }
  if (path === "/api/admin/schedule-events") {
    if (request.method === "GET")
      return json(
        await listEvents(
          env.DB,
          validateEventRange(new URL(request.url).searchParams),
        ),
      );
    if (request.method === "POST")
      return json(
        await createEvent(
          env.DB,
          validateEvent(await readJson(request)).payload,
          auth.user.id,
        ),
        201,
      );
  }
  const match = path.match(/^\/api\/admin\/schedule-events\/([1-9]\d*)$/);
  if (!match) return null;
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id))
    throw new ApiError(404, "EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.");
  if (request.method === "GET") {
    const event = await getEvent(env.DB, id);
    if (!event)
      throw new ApiError(404, "EVENT_NOT_FOUND", "일정을 찾을 수 없습니다.");
    return json(event);
  }
  if (request.method === "PUT") {
    const { payload, revision } = validateEvent(await readJson(request), true),
      saved = await updateEvent(env.DB, id, payload, revision, auth.user.id);
    if (!saved) conflict();
    return json(saved);
  }
  if (request.method === "DELETE") {
    const body = await readJson(request);
    if (
      !body ||
      Object.keys(body).length !== 1 ||
      !Object.hasOwn(body, "expected_revision")
    )
      throw new ApiError(
        422,
        "EVENT_REVISION",
        "삭제할 일정 버전을 확인해주세요.",
      );
    const removed = await deleteEvent(
      env.DB,
      id,
      validateEventRevision(body.expected_revision),
    );
    if (!removed) conflict();
    return json({ ok: true, id });
  }
  return null;
}
