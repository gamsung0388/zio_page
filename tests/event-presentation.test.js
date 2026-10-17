import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyEvent } from "../shared/schedule/events.js";
import {
  eventDateLabel,
  eventRangeLabel,
  eventFormIssue,
  eventDurationLabel,
  nextEndDate,
} from "../src/schedule/event-presentation.js";
const payload = (extra = {}) => ({
  ...emptyEvent("2027-01-04"),
  title: "방송",
  ...extra,
});
test("readable schedule labels retain civil dates, weekdays and midnight across browser timezones", () => {
  const old = process.env.TZ;
  try {
    for (const zone of [
      "Asia/Seoul",
      "America/Los_Angeles",
      "Pacific/Kiritimati",
    ]) {
      process.env.TZ = zone;
      assert.match(eventDateLabel("2027-01-04"), /1월 4일.*월/);
      assert.equal(eventRangeLabel(payload()), "1월 4일 (월) · 20:00–22:00");
      assert.equal(
        eventRangeLabel(payload({ end_date: "2027-01-05", end_time: "00:00" })),
        "1월 4일 (월) 20:00 ~ 1월 5일 (화) 00:00",
      );
      assert.match(
        eventRangeLabel(
          payload({
            time_mode: "all_day",
            start_time: "",
            end_time: "",
            end_date: "2027-01-06",
          }),
        ),
        /1월 6일.*종일/,
      );
      assert.equal(eventDateLabel("invalid"), "");
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test("duration preview handles overnight, whole-day inclusive periods and invalid end times", () => {
  assert.equal(eventDurationLabel(payload()), "2시간");
  assert.equal(
    eventDurationLabel(
      payload({
        title: "",
        start_time: "23:30",
        end_date: "2027-01-06",
        end_time: "01:00",
      }),
    ),
    "1일 1시간 30분",
  );
  assert.equal(
    eventDurationLabel(
      payload({
        time_mode: "undecided",
        start_time: "",
        end_time: "",
        end_date: "2027-01-06",
      }),
    ),
    "3일 · 종료일 포함",
  );
  assert.equal(eventDurationLabel(payload({ end_time: "19:00" })), "");
  assert.equal(
    nextEndDate(payload({ start_date: "2024-02-28" })),
    "2024-02-29",
  );
  assert.equal(nextEndDate(payload({ start_date: "2099-12-31" })), "");
});
test("both save actions can identify the first invalid input without losing incomplete drafts", () => {
  assert.equal(eventFormIssue(payload()), null);
  for (const [extra, field] of [
    [{ title: " " }, "title"],
    [{ start_date: "" }, "start_date"],
    [{ end_date: "2027-01-03" }, "end_date"],
    [{ start_time: "" }, "start_time"],
    [{ end_time: "" }, "end_time"],
    [{ end_time: "19:00" }, "end_time"],
    [{ end_date: "2028-01-05" }, "end_date"],
  ]) {
    const data = payload(extra),
      before = JSON.stringify(data);
    assert.equal(eventFormIssue(data).field, field);
    assert.equal(JSON.stringify(data), before);
  }
});
