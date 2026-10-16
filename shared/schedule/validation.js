import {
  DAY_OPTIONS,
  TEMPLATE_MAP,
  FONT_SIZE_LIMITS,
  DEFAULT_EDITOR_OPTIONS,
} from "./scheduleConfig.js";
import { isRecord, isValidEditorOption } from "./scheduleFactory.js";
import { isDate, mondayOf } from "./dates.js";
function invalid(message) {
  throw new Error(message);
}
function keys(value, allowed) {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !Object.hasOwn(value, key))
  )
    invalid("일정 데이터의 항목을 확인해주세요.");
}
export function validateSchedulePayload(input) {
  keys(input, ["selectedTemplate", "scheduleForm", "editorOptions"]);
  if (
    typeof input.selectedTemplate !== "string" ||
    !Object.hasOwn(TEMPLATE_MAP, input.selectedTemplate)
  )
    invalid("등록된 일정 템플릿을 선택해주세요.");
  keys(
    input.scheduleForm,
    DAY_OPTIONS.map((day) => day.key),
  );
  const scheduleForm = {};
  for (const { key } of DAY_OPTIONS) {
    const entry = input.scheduleForm[key];
    keys(entry, ["content", "time"]);
    for (const [field, max] of [
      ["content", 500],
      ["time", 40],
    ])
      if (
        typeof entry[field] !== "string" ||
        Array.from(entry[field]).length > max
      )
        invalid(
          field === "content"
            ? "일정 내용은 500자 이하로 입력해주세요."
            : "시간 안내는 40자 이하로 입력해주세요.",
        );
    scheduleForm[key] = { content: entry.content, time: entry.time };
  }
  keys(input.editorOptions, Object.keys(DEFAULT_EDITOR_OPTIONS));
  for (const [key, value] of Object.entries(input.editorOptions)) {
    if (!isValidEditorOption(key, value)) invalid("글자 옵션을 확인해주세요.");
    const limits = FONT_SIZE_LIMITS[key];
    if (
      limits &&
      (!Number.isInteger(value) || value < limits.min || value > limits.max)
    )
      invalid("글자 크기가 허용 범위를 벗어났습니다.");
  }
  return {
    selectedTemplate: input.selectedTemplate,
    scheduleForm,
    editorOptions: { ...input.editorOptions },
  };
}
export function schedulePayload(value) {
  return validateSchedulePayload({
    selectedTemplate: value?.selectedTemplate,
    scheduleForm: value?.scheduleForm,
    editorOptions: value?.editorOptions,
  });
}
export function validateScheduleBackup(input) {
  keys(input, ["version", "exported_at", "weeks"]);
  if (
    input.version !== 1 ||
    typeof input.exported_at !== "string" ||
    !Number.isFinite(Date.parse(input.exported_at)) ||
    !Array.isArray(input.weeks) ||
    input.weeks.length > 2000
  )
    invalid("지원하지 않는 일정 백업 형식입니다.");
  const seen = new Set();
  const weeks = input.weeks.map((week) => {
    keys(week, [
      "week_start",
      "selectedTemplate",
      "scheduleForm",
      "editorOptions",
    ]);
    if (
      !isDate(week.week_start) ||
      mondayOf(week.week_start) !== week.week_start ||
      seen.has(week.week_start)
    )
      invalid("백업의 주 날짜가 올바르지 않거나 중복되었습니다.");
    seen.add(week.week_start);
    return { week_start: week.week_start, ...schedulePayload(week) };
  });
  return { version: 1, exported_at: input.exported_at, weeks };
}
