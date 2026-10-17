import {
  monthDates,
  shiftMonth,
  addDays,
} from "../../shared/schedule/dates.js";
import { eventOverlaps, kstInstant } from "../../shared/schedule/event-time.js";
export const EVENT_LIST_PAGE_SIZE = 50;
export function monthRange(month) {
  return { from: month + "-01", to: addDays(shiftMonth(month, 1) + "-01", -1) };
}
export function eventQuery({ month, view, day = "", kind = "", page = 1 }) {
  const dates = monthDates(month);
  const range =
    view === "calendar"
      ? { from: dates[0], to: dates.at(-1) }
      : day && dates.includes(day)
        ? { from: day, to: day }
        : monthRange(month);
  return { ...range, kind, view, page: view === "list" ? page : 1 };
}
export function eventsInMonth(events, month) {
  const start = kstInstant(month + "-01"),
    end = kstInstant(shiftMonth(month, 1) + "-01");
  return events.filter((event) => eventOverlaps(event, start, end));
}
export function groupEventList(events, month, day = "") {
  const groups = new Map();
  for (const event of events) {
    const date =
      day ||
      (event.start_date < month + "-01" ? month + "-01" : event.start_date);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(event);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}
