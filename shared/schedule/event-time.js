import { isDate } from "./dates.js";
export const DAY = 86400000;
export const isTime = (value) =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export function kstInstant(date, time = "00:00") {
  if (!isDate(date) || !isTime(time))
    throw new Error("날짜와 시간을 확인해주세요.");
  return new Date(date + "T" + time + ":00+09:00").toISOString();
}
export function dayBounds(date) {
  const start = kstInstant(date);
  return { start, end: new Date(Date.parse(start) + DAY).toISOString() };
}
export function eventOverlaps(event, start, end) {
  return event.starts_at < end && event.ends_at > start;
}
