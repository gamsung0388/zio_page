import { addDays, isDate } from "../../shared/schedule/dates.js";
import {
  isEventDate,
  isTime,
  validateEventPayload,
} from "../../shared/schedule/events.js";
const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});
export function eventDateLabel(date) {
  return isDate(date)
    ? dateFormatter.format(new Date(date + "T00:00:00Z"))
    : "";
}
export function eventRangeLabel(event) {
  const start = eventDateLabel(event.start_date),
    end = eventDateLabel(event.end_date);
  if (event.time_mode === "timed")
    return event.start_date === event.end_date
      ? start + " · " + event.start_time + "–" + event.end_time
      : start + " " + event.start_time + " ~ " + end + " " + event.end_time;
  return (
    (event.start_date === event.end_date ? start : start + " ~ " + end) +
    " · " +
    (event.time_mode === "all_day" ? "종일" : "시간 미정")
  );
}
export function eventFormIssue(input) {
  try {
    validateEventPayload(input);
    return null;
  } catch (error) {
    let field = "end_time";
    if (!input.title.trim() || Array.from(input.title.trim()).length > 120)
      field = "title";
    else if (Array.from(input.description.trim()).length > 2000)
      field = "description";
    else if (!isEventDate(input.start_date)) field = "start_date";
    else if (
      !isEventDate(input.end_date) ||
      input.end_date < input.start_date ||
      (Date.parse(input.end_date) - Date.parse(input.start_date)) / 86400000 >
        365
    )
      field = "end_date";
    else if (input.time_mode === "timed" && !isTime(input.start_time))
      field = "start_time";
    return { field, message: error.message };
  }
}
export function eventDurationLabel(input) {
  try {
    const value = validateEventPayload({
      ...input,
      title: input.title.trim() || "일정",
    });
    if (input.time_mode !== "timed")
      return (
        String(
          (Date.parse(value.ends_at) - Date.parse(value.starts_at)) / 86400000,
        ) + "일 · 종료일 포함"
      );
    const minutes =
      (Date.parse(value.ends_at) - Date.parse(value.starts_at)) / 60000;
    const days = Math.floor(minutes / 1440),
      hours = Math.floor((minutes % 1440) / 60),
      rest = minutes % 60;
    return [
      days ? days + "일" : "",
      hours ? hours + "시간" : "",
      rest ? rest + "분" : "",
    ]
      .filter(Boolean)
      .join(" ");
  } catch {
    return "";
  }
}
export function nextEndDate(form) {
  if (!isEventDate(form.start_date) || form.start_date === "2099-12-31")
    return "";
  return addDays(form.start_date, 1);
}
