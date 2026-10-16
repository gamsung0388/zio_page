// Dates in this module are civil calendar dates; UTC arithmetic avoids browser timezone drift.
export function isDate(value) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function addDays(value, days) {
  if (!isDate(value) || !Number.isInteger(days))
    throw new Error("올바른 날짜가 필요합니다.");
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function mondayOf(value) {
  if (!isDate(value)) throw new Error("올바른 날짜가 필요합니다.");
  return addDays(
    value,
    -((new Date(value + "T00:00:00Z").getUTCDay() + 6) % 7),
  );
}
export function todayKst(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return parts.year + "-" + parts.month + "-" + parts.day;
}
export function shiftMonth(month, amount) {
  if (!isDate(month + "-01")) throw new Error("올바른 월이 필요합니다.");
  const date = new Date(month + "-01T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
export function monthDates(month) {
  if (!isDate(month + "-01")) throw new Error("올바른 월이 필요합니다.");
  const start = mondayOf(month + "-01");
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}
export function dateLabel(value) {
  return value.replaceAll("-", ". ");
}
