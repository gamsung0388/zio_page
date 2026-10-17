import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCalendarWeeks } from "../shared/schedule/event-calendar.js";
import { monthDates } from "../shared/schedule/dates.js";
import {
  emptyEvent,
  validateEventPayload,
  eventFromRow,
} from "../shared/schedule/events.js";
const event = (id, start, end, extra = {}) =>
  eventFromRow({
    ...validateEventPayload({
      ...emptyEvent(start),
      title: "일정 " + id,
      end_date: end,
      ...extra,
    }),
    id,
    revision: 1,
  });
const allDay = (id, start, end) =>
  event(id, start, end, { time_mode: "all_day", start_time: "", end_time: "" });
test("periods become one continuous bar per week, including a clipped first and last week", () => {
  const item = event(1, "2026-10-17", "2026-10-30"),
    snapshot = JSON.stringify(item);
  const weeks = buildCalendarWeeks([item], monthDates("2026-10"));
  const segments = weeks.flatMap((week) => week.segments);
  assert.deepEqual(
    segments.map(
      ({
        start,
        end,
        column,
        span,
        continuesBefore,
        continuesAfter,
        lane,
      }) => ({
        start,
        end,
        column,
        span,
        continuesBefore,
        continuesAfter,
        lane,
      }),
    ),
    [
      {
        start: "2026-10-17",
        end: "2026-10-18",
        column: 6,
        span: 2,
        continuesBefore: false,
        continuesAfter: true,
        lane: 0,
      },
      {
        start: "2026-10-19",
        end: "2026-10-25",
        column: 1,
        span: 7,
        continuesBefore: true,
        continuesAfter: true,
        lane: 0,
      },
      {
        start: "2026-10-26",
        end: "2026-10-30",
        column: 1,
        span: 5,
        continuesBefore: true,
        continuesAfter: false,
        lane: 0,
      },
    ],
  );
  assert.equal(
    weeks.flatMap((week) => week.days).some((day) => day.items.includes(item)),
    false,
  );
  assert.equal(JSON.stringify(item), snapshot);
});
test("midnight is exclusive while all-day and undecided final dates remain included", () => {
  const timed = event(1, "2027-01-04", "2027-01-06", {
    start_time: "23:00",
    end_time: "00:00",
  });
  const midnight = event(2, "2027-01-08", "2027-01-09", {
    start_time: "23:00",
    end_time: "00:00",
  });
  const all = allDay(3, "2027-01-04", "2027-01-06");
  const unsure = event(4, "2027-01-07", "2027-01-09", {
    time_mode: "undecided",
    start_time: "",
    end_time: "",
  });
  const weeks = buildCalendarWeeks(
    [timed, midnight, all, unsure],
    monthDates("2027-01"),
  );
  const segments = weeks.flatMap((week) => week.segments);
  assert.equal(
    segments.find((segment) => segment.event === timed).end,
    "2027-01-05",
  );
  assert.equal(
    segments.find((segment) => segment.event === all).end,
    "2027-01-06",
  );
  assert.equal(
    segments.find((segment) => segment.event === unsure).end,
    "2027-01-09",
  );
  assert.equal(
    segments.some((segment) => segment.event === midnight),
    false,
  );
  assert.ok(
    weeks
      .flatMap((week) => week.days)
      .find((day) => day.date === "2027-01-08")
      .items.includes(midnight),
  );
});
test("overlapping bars stay on distinct lanes and a continuing event retains its visible lane", () => {
  const items = [
    allDay(1, "2027-01-04", "2027-01-06"),
    allDay(2, "2027-01-05", "2027-01-15"),
    allDay(3, "2027-01-07", "2027-01-08"),
  ];
  const weeks = buildCalendarWeeks(items, monthDates("2027-01"));
  const first = weeks.find((week) => week.start === "2027-01-04"),
    next = weeks.find((week) => week.start === "2027-01-11");
  assert.deepEqual(
    first.segments.map((segment) => segment.lane),
    [0, 1, 0],
  );
  assert.equal(next.segments[0].lane, 1);
  for (const week of weeks)
    for (const segment of week.segments)
      for (const other of week.segments) {
        if (segment === other || segment.lane !== other.lane) continue;
        assert.ok(segment.end < other.start || other.end < segment.start);
      }
});
test("hidden periods and one-day events are all counted in each day overflow", () => {
  const items = [1, 2, 3, 4].map((id) =>
    allDay(id, "2027-01-04", "2027-01-05"),
  );
  items.push(event(5, "2027-01-04", "2027-01-04"));
  const week = buildCalendarWeeks(items, monthDates("2027-01")).find(
    (week) => week.start === "2027-01-04",
  );
  assert.equal(week.segments.length, 3);
  assert.equal(week.days[0].hidden, 2);
  assert.equal(week.days[1].hidden, 1);
  const singles = Array.from({ length: 55 }, (_, id) =>
    event(id, "2027-01-06", "2027-01-06"),
  );
  const day = buildCalendarWeeks(singles, monthDates("2027-01"))
    .flatMap((week) => week.days)
    .find((day) => day.date === "2027-01-06");
  assert.equal(day.items.length, 3);
  assert.equal(day.hidden, 52);
});
test("empty weeks, leap dates, year boundaries and month-clipped periods keep seven valid columns", () => {
  const dates = monthDates("2028-02"),
    items = [
      allDay(1, "2028-01-01", "2028-03-31"),
      allDay(2, "2028-02-28", "2028-03-01"),
    ];
  const weeks = buildCalendarWeeks(items, dates);
  assert.equal(weeks.length, 6);
  assert.equal(weeks[0].segments[0].continuesBefore, true);
  assert.equal(weeks.at(-1).segments[0].continuesAfter, true);
  assert.ok(
    weeks.some((week) => week.days.some((day) => day.date === "2028-02-29")),
  );
  for (const week of weeks)
    for (const segment of week.segments)
      assert.ok(segment.column >= 1 && segment.column + segment.span <= 8);
  assert.ok(
    buildCalendarWeeks([], monthDates("2027-01")).every(
      (week) => week.lanes === 0 && week.days.length === 7,
    ),
  );
  assert.equal(
    buildCalendarWeeks(
      [allDay(3, "2026-12-31", "2027-01-02")],
      monthDates("2027-01"),
    )[0].segments[0].span,
    3,
  );
});
