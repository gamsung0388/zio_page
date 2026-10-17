import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyEvent,
  validateEventPayload,
  eventOccursOn,
  projectEventsToWeek,
} from "../shared/schedule/events.js";
import { indexEventsByDate } from "../shared/schedule/event-index.js";
import { monthDates } from "../shared/schedule/dates.js";
import {
  eventQuery,
  eventsInMonth,
  groupEventList,
} from "../src/schedule/event-query.js";
test("schedule queries separate month, individual date and calendar grid, including leap years and adjacent days", () => {
  const query = (extra = {}) =>
    eventQuery({
      month: "2028-02",
      view: "list",
      kind: "broadcast",
      page: 2,
      ...extra,
    });
  assert.deepEqual(query(), {
    from: "2028-02-01",
    to: "2028-02-29",
    kind: "broadcast",
    view: "list",
    page: 2,
  });
  assert.equal(query({ day: "2028-02-15" }).to, "2028-02-15");
  assert.equal(query({ day: "2028-01-31" }).from, "2028-01-31");
  assert.equal(query({ day: "2027-12-31" }).from, "2028-02-01");
  const calendar = query({ view: "calendar", day: "2028-02-15" });
  assert.equal(calendar.from, "2028-01-31");
  assert.equal(calendar.to, "2028-03-12");
  assert.equal(calendar.page, 1);
});
test("precomputed date index agrees with interval semantics for midnight, overnight, inclusive dates and long periods", () => {
  const event = (extra) =>
    validateEventPayload({
      ...emptyEvent("2028-02-28"),
      title: "방송",
      ...extra,
    });
  const events = [
    event({ start_time: "23:00", end_date: "2028-02-29", end_time: "00:00" }),
    event({ start_time: "23:00", end_date: "2028-02-29", end_time: "01:00" }),
    event({
      time_mode: "all_day",
      start_time: "",
      end_time: "",
      end_date: "2028-03-02",
    }),
    event({
      time_mode: "undecided",
      start_time: "",
      end_time: "",
      start_date: "2028-01-01",
      end_date: "2028-12-31",
    }),
  ];
  const before = JSON.stringify(events);
  const dates = [...monthDates("2028-02"), "2099-12-31", "2100-01-01"];
  const result = indexEventsByDate(events, dates);
  for (const date of dates)
    assert.deepEqual(
      result.get(date),
      events.filter((item) => eventOccursOn(item, date)),
      date,
    );
  assert.equal(result.get("2028-02-29").includes(events[0]), false);
  assert.equal(result.get("2028-02-29").includes(events[1]), true);
  assert.equal(result.get("2028-03-02").includes(events[2]), true);
  assert.equal(JSON.stringify(events), before);
  const projected = projectEventsToWeek(events.slice(0, 2), "2028-02-28");
  assert.equal(projected.mon.time, "일정 2개");
  assert.equal(projected.tue.time, "01:00까지");
});
test("month and grouped list retain cross-month periods once, without mutating server order", () => {
  const span = validateEventPayload({
    ...emptyEvent("2028-01-31"),
    title: "기간",
    time_mode: "all_day",
    start_time: "",
    end_time: "",
    end_date: "2028-02-03",
  });
  const ended = validateEventPayload({
    ...emptyEvent("2028-01-31"),
    title: "자정 종료",
    start_time: "23:00",
    end_date: "2028-02-01",
    end_time: "00:00",
  });
  assert.deepEqual(eventsInMonth([span, ended], "2028-02"), [span]);
  assert.equal(groupEventList([span], "2028-02")[0].date, "2028-02-01");
  assert.equal(
    groupEventList([span], "2028-02", "2028-02-02")[0].date,
    "2028-02-02",
  );
});
