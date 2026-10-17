import { ApiError } from "../utils/http.js";
import { isDate } from "../../shared/schedule/dates.js";
import {
  EVENT_KINDS,
  kstInstant,
  validateEventPayload,
} from "../../shared/schedule/events.js";
export function validateEventRange(params) {
  const allowed = ["from", "to", "kind", "page", "page_size"];
  const from = params.get("from"),
    to = params.get("to"),
    kind = params.get("kind") || "",
    page = params.get("page") || "1",
    page_size = params.get("page_size") || "200";
  if (
    [...params.keys()].some(
      (key) => !allowed.includes(key) || params.getAll(key).length > 1,
    ) ||
    !isDate(from) ||
    !isDate(to) ||
    from < "1999-01-01" ||
    to > "2100-12-31" ||
    from > to ||
    (Date.parse(to) - Date.parse(from)) / 86400000 > 62 ||
    (kind && !EVENT_KINDS.some((item) => item.value === kind)) ||
    !/^[1-9]\d*$/.test(page) ||
    Number(page) > 10000 ||
    !/^[1-9]\d*$/.test(page_size) ||
    Number(page_size) > 200
  )
    throw new ApiError(
      400,
      "EVENT_RANGE",
      "조회할 날짜·일정 구분·페이지를 확인해주세요. 한 번에 최대 63일을 조회합니다.",
    );
  return {
    from: kstInstant(from),
    to: new Date(Date.parse(kstInstant(to)) + 86400000).toISOString(),
    kind,
    page: Number(page),
    page_size: Number(page_size),
  };
}
export function validateEvent(input, updating = false) {
  try {
    let value = input,
      revision;
    if (updating) {
      revision = validateEventRevision(input?.expected_revision);
      const { expected_revision, ...fields } = input;
      value = fields;
    }
    return { payload: validateEventPayload(value), revision };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "EVENT_VALIDATION", error.message);
  }
}
export function validateEventRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new ApiError(
      422,
      "EVENT_REVISION",
      "저장된 일정 버전을 확인해주세요.",
    );
  return value;
}
