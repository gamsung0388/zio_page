import { isDate, addDays } from "./dates.js";
import { createScheduleForm } from "./scheduleFactory.js";
export const EVENT_KINDS = Object.freeze([
  { value: "broadcast", label: "방송" },
  { value: "collab", label: "합방" },
  { value: "off", label: "휴방" },
  { value: "personal", label: "개인" },
  { value: "other", label: "기타" },
]);
export const TIME_MODES = Object.freeze([
  { value: "timed", label: "시간 지정" },
  { value: "all_day", label: "종일" },
  { value: "undecided", label: "시간 미정" },
]);
export const EVENT_DATE_MIN = "2000-01-01",
  EVENT_DATE_MAX = "2099-12-31";
const DAY = 86400000,
  OFFSET = 9 * 3600000;
export const isTime = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export const isEventDate = (value) =>
  isDate(value) && value >= EVENT_DATE_MIN && value <= EVENT_DATE_MAX;
export function kstInstant(date, time = "00:00") {
  if (!isDate(date) || !isTime(time))
    throw new Error("날짜와 시간을 확인해주세요.");
  return new Date(date + "T" + time + ":00+09:00").toISOString();
}
function kstParts(instant) {
  const value = new Date(Date.parse(instant) + OFFSET).toISOString();
  return { date: value.slice(0, 10), time: value.slice(11, 16) };
}
export function eventInput(event) {
  return Object.fromEntries(
    [
      "title",
      "description",
      "kind",
      "time_mode",
      "start_date",
      "end_date",
      "start_time",
      "end_time",
    ].map((key) => [key, event[key]]),
  );
}
export function emptyEvent(date) {
  return {
    title: "",
    description: "",
    kind: "broadcast",
    time_mode: "timed",
    start_date: date,
    end_date: date,
    start_time: "20:00",
    end_time: "22:00",
  };
}
export function validateEventPayload(input) {
  const fields = [
    "title",
    "description",
    "kind",
    "time_mode",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
  ];
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !fields.includes(key)) ||
    fields.some((key) => !Object.hasOwn(input, key))
  )
    throw new Error("일정의 입력 항목을 확인해주세요.");
  for (const [key, label, max, required] of [
    ["title", "일정 제목", 120, true],
    ["description", "일정 메모", 2000, false],
  ])
    if (
      typeof input[key] !== "string" ||
      Array.from(input[key].trim()).length > max ||
      (required && !input[key].trim())
    )
      throw new Error(
        label +
          "은 " +
          (required ? "1" : "0") +
          "~" +
          max +
          "자로 입력해주세요.",
      );
  if (
    !EVENT_KINDS.some((kind) => kind.value === input.kind) ||
    !TIME_MODES.some((mode) => mode.value === input.time_mode)
  )
    throw new Error("일정 구분과 시간 방식을 확인해주세요.");
  if (!isEventDate(input.start_date) || !isEventDate(input.end_date))
    throw new Error("날짜는 2000년부터 2099년 사이로 선택해주세요.");
  if (
    input.end_date < input.start_date ||
    (Date.parse(input.end_date) - Date.parse(input.start_date)) / DAY > 365
  )
    throw new Error(
      "종료일은 시작일 이후로, 기간은 최대 366일로 지정해주세요.",
    );
  let starts_at, ends_at;
  if (input.time_mode === "timed") {
    if (!isTime(input.start_time) || !isTime(input.end_time))
      throw new Error("시작·종료 시간을 시:분 형식으로 입력해주세요.");
    starts_at = kstInstant(input.start_date, input.start_time);
    ends_at = kstInstant(input.end_date, input.end_time);
    if (ends_at <= starts_at)
      throw new Error(
        "종료 일시는 시작 일시보다 늦어야 해요. 자정을 넘기면 종료일도 바꿔주세요.",
      );
  } else {
    if (input.start_time !== "" || input.end_time !== "")
      throw new Error("종일·시간 미정 일정에는 시각을 입력하지 않습니다.");
    starts_at = kstInstant(input.start_date);
    ends_at = kstInstant(addDays(input.end_date, 1));
  }
  return {
    ...eventInput(input),
    title: input.title.trim(),
    description: input.description.trim(),
    starts_at,
    ends_at,
  };
}
export function eventFromRow(row) {
  if (!row) return null;
  const start = kstParts(row.starts_at),
    end = kstParts(row.ends_at),
    timed = row.time_mode === "timed";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    time_mode: row.time_mode,
    start_date: start.date,
    end_date: timed ? end.date : addDays(end.date, -1),
    start_time: timed ? start.time : "",
    end_time: timed ? end.time : "",
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    revision: row.revision,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
export function eventOccursOn(event, date) {
  const start = kstInstant(date),
    end = new Date(Date.parse(start) + DAY).toISOString();
  return event.starts_at < end && event.ends_at > start;
}
export function eventTimeLabel(event, date) {
  if (event.time_mode === "all_day") return "종일";
  if (event.time_mode === "undecided") return "시간 미정";
  if (!date || event.start_date === event.end_date)
    return event.start_time + "–" + event.end_time;
  if (date === event.start_date)
    return (
      event.start_time +
      (event.end_date === addDays(date, 1) && event.end_time === "00:00"
        ? "–다음날 00:00"
        : "부터")
    );
  if (date === event.end_date) return event.end_time + "까지";
  return "진행 중";
}
export function eventPeriodLabel(event) {
  return (
    event.start_date +
    (event.time_mode === "timed" ? " " + event.start_time : "") +
    " ~ " +
    event.end_date +
    (event.time_mode === "timed" ? " " + event.end_time : "")
  );
}
export function projectEventsToWeek(events, week) {
  const form = createScheduleForm(),
    keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  for (let index = 0; index < 7; index++) {
    const date = addDays(week, index),
      items = events
        .filter((event) => eventOccursOn(event, date))
        .sort(
          (a, b) =>
            a.starts_at.localeCompare(b.starts_at) || (a.id || 0) - (b.id || 0),
        );
    if (items.length === 1)
      form[keys[index]] = {
        content: items[0].title,
        time: eventTimeLabel(items[0], date),
      };
    else if (items.length > 1)
      form[keys[index]] = {
        content: items
          .map((event) => eventTimeLabel(event, date) + " " + event.title)
          .join("\n"),
        time: "일정 " + items.length + "개",
      };
    if (
      Array.from(form[keys[index]].content).length > 500 ||
      Array.from(form[keys[index]].time).length > 40
    )
      throw new Error(
        "이미지 칸의 길이를 넘는 날짜가 있어요. 가져올 일정을 줄여주세요.",
      );
  }
  return form;
}
export function isEventDraft(value) {
  if (
    !value ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    !value.form ||
    typeof value.form !== "object"
  )
    return false;
  const form = value.form,
    limits = {
      title: 120,
      description: 2000,
      start_date: 10,
      end_date: 10,
      start_time: 5,
      end_time: 5,
    };
  return (
    !Array.isArray(form) &&
    Object.keys(value).every((key) => ["form", "revision"].includes(key)) &&
    Object.keys(form).every((key) => Object.hasOwn(emptyEvent(""), key)) &&
    Object.keys(emptyEvent("")).every((key) => Object.hasOwn(form, key)) &&
    Object.entries(limits).every(
      ([key, max]) =>
        typeof form[key] === "string" && Array.from(form[key]).length <= max,
    ) &&
    EVENT_KINDS.some((kind) => kind.value === form.kind) &&
    TIME_MODES.some((mode) => mode.value === form.time_mode)
  );
}
export function validateEventBackup(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !["format", "version", "exported_at", "events"].includes(key),
    ) ||
    input.format !== "zio-schedule-events" ||
    input.version !== 1 ||
    typeof input.exported_at !== "string" ||
    !Number.isFinite(Date.parse(input.exported_at)) ||
    !Array.isArray(input.events) ||
    input.events.length > 2000
  )
    throw new Error("지원하지 않는 개별 일정 백업입니다.");
  return {
    format: input.format,
    version: 1,
    exported_at: input.exported_at,
    events: input.events.map((event) =>
      eventInput(validateEventPayload(event)),
    ),
  };
}
