import { addDays } from "./dates.js";
import { indexEventsByDate } from "./event-index.js";

// Timed midnight is exclusive; all-day and undecided end dates are inclusive.
function lastOccupiedDate(event) {
  return event.time_mode === "timed" && event.end_time === "00:00"
    ? addDays(event.end_date, -1)
    : event.end_date;
}

export function buildCalendarWeeks(events, dates, limit = 3) {
  const byDate = indexEventsByDate(events, dates);
  const periods = events
    .map((event, order) => ({ event, order, end: lastOccupiedDate(event) }))
    .filter(({ event, end }) => event.start_date < end)
    .sort(
      (a, b) =>
        a.event.start_date.localeCompare(b.event.start_date) ||
        b.end.localeCompare(a.end) ||
        a.order - b.order,
    );
  const periodEvents = new Set(periods.map((item) => item.event));
  const weeks = [];
  let previousLanes = new Map();
  for (let offset = 0; offset < dates.length; offset += 7) {
    const weekDates = dates.slice(offset, offset + 7);
    const start = weekDates[0],
      end = weekDates.at(-1);
    const lanes = [],
      segments = [],
      nextLanes = new Map();
    for (const item of periods) {
      if (item.event.start_date > end || item.end < start) continue;
      const first =
        item.event.start_date < start ? start : item.event.start_date;
      const last = item.end > end ? end : item.end;
      const column = weekDates.indexOf(first),
        lastColumn = weekDates.indexOf(last);
      const available = (lane) =>
        !(lanes[lane] || []).some(
          (range) => column <= range.end && lastColumn >= range.start,
        );
      const previous = previousLanes.get(item.event);
      let lane =
        previous !== undefined && previous < limit && available(previous)
          ? previous
          : -1;
      if (lane < 0) {
        lane = 0;
        while (lane < limit && !available(lane)) lane++;
      }
      if (lane < limit)
        (lanes[lane] ||= []).push({ start: column, end: lastColumn });
      nextLanes.set(item.event, lane);
      if (lane < limit)
        segments.push({
          event: item.event,
          lane,
          column: column + 1,
          span: lastColumn - column + 1,
          start: first,
          end: last,
          continuesBefore: item.event.start_date < first,
          continuesAfter: item.end > last,
        });
    }
    const days = weekDates.map((date) => {
      const all = byDate.get(date) || [];
      const visiblePeriods = segments.filter(
        (segment) => segment.start <= date && segment.end >= date,
      ).length;
      const items = all
        .filter((event) => !periodEvents.has(event))
        .slice(0, Math.max(0, limit - visiblePeriods));
      return {
        date,
        items,
        hidden: all.length - visiblePeriods - items.length,
      };
    });
    weeks.push({
      start,
      days,
      segments,
      lanes: Math.max(0, ...segments.map((segment) => segment.lane + 1)),
    });
    previousLanes = nextLanes;
  }
  return weeks;
}
