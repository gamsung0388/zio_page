import { ApiError } from "../utils/http.js";
import { isRecord } from "../../shared/schedule/scheduleFactory.js";
import { validateSchedulePayload } from "../../shared/schedule/validation.js";
import { isDate, mondayOf } from "../../shared/schedule/dates.js";
export function validateWeek(value) {
  if (!isDate(value) || mondayOf(value) !== value)
    throw new ApiError(
      400,
      "SCHEDULE_WEEK",
      "주는 월요일 날짜로 지정해주세요.",
    );
  return value;
}
export function validateRange(params) {
  const from = params.get("from"),
    to = params.get("to");
  if (
    [...params.keys()].some((key) => !["from", "to"].includes(key)) ||
    !isDate(from) ||
    !isDate(to) ||
    from > to ||
    (Date.parse(to) - Date.parse(from)) / 86400000 > 62
  )
    throw new ApiError(
      400,
      "SCHEDULE_RANGE",
      "일정은 시작일부터 최대 63일 범위로 조회해주세요.",
    );
  return { from: mondayOf(from), to: mondayOf(to) };
}
export function validateSchedule(input) {
  try {
    if (
      !isRecord(input) ||
      !Object.hasOwn(input, "expected_revision") ||
      !Number.isSafeInteger(input.expected_revision) ||
      input.expected_revision < 0
    )
      throw new Error("저장 버전을 확인해주세요.");
    const { expected_revision, ...value } = input;
    return { expected_revision, payload: validateSchedulePayload(value) };
  } catch (error) {
    throw new ApiError(422, "SCHEDULE_VALIDATION", error.message);
  }
}

export function validateScheduleDelete(input) {
  if (
    !isRecord(input) ||
    Object.keys(input).length !== 1 ||
    !Object.hasOwn(input, "expected_revision") ||
    !Number.isSafeInteger(input.expected_revision) ||
    input.expected_revision < 1
  )
    throw new ApiError(
      422,
      "SCHEDULE_VALIDATION",
      "삭제할 저장 버전을 확인해주세요.",
    );
  return input.expected_revision;
}
