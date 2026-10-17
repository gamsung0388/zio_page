import { dayBounds, eventOverlaps } from "./event-time.js";

// Bounds are computed once per civil date, never once per date/event pair.
// Preserve server order; both calendar and weekly projection use this index.
export function indexEventsByDate(events, dates) {
  const bounds = dates.map((date) => ({ date, ...dayBounds(date) }));
  return new Map(
    bounds.map(({ date, start, end }) => [
      date,
      events.filter((event) => eventOverlaps(event, start, end)),
    ]),
  );
}
