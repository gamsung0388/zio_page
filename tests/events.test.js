import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateEventPayload,
  eventInput,
  eventFromRow,
  kstInstant,
  eventOccursOn,
  eventTimeLabel,
  projectEventsToWeek,
  emptyEvent,
  isEventDraft,
  validateEventBackup,
} from "../shared/schedule/events.js";
const payload = (extra = {}) => ({
  ...emptyEvent("2027-01-04"),
  title: "방송",
  ...extra,
});
test("typed KST event times round-trip through UTC independently of the host timezone", () => {
  const data = validateEventPayload(
    payload({ start_time: "20:30", end_time: "23:00" }),
  );
  assert.equal(data.starts_at, "2027-01-04T11:30:00.000Z");
  const result = eventFromRow({ ...data, id: 1, revision: 1 });
  assert.deepEqual(eventInput(result), eventInput(data));
  assert.equal(kstInstant("2027-01-01", "00:00"), "2026-12-31T15:00:00.000Z");
});
test("timed midnight ending belongs only to the preceding date while all-day end dates are inclusive", () => {
  const timed = validateEventPayload(
    payload({ start_time: "23:00", end_date: "2027-01-05", end_time: "00:00" }),
  );
  assert.equal(eventOccursOn(timed, "2027-01-04"), true);
  assert.equal(eventOccursOn(timed, "2027-01-05"), false);
  assert.equal(eventTimeLabel(timed, "2027-01-04"), "23:00–다음날 00:00");
  const all = validateEventPayload(
    payload({
      time_mode: "all_day",
      start_time: "",
      end_time: "",
      end_date: "2027-01-06",
    }),
  );
  assert.equal(eventOccursOn(all, "2027-01-06"), true);
  assert.equal(eventOccursOn(all, "2027-01-07"), false);
  assert.equal(eventFromRow(all).end_date, "2027-01-06");
});
test("period validation handles leap years, 366-day boundaries, malformed clocks and reversed ranges", () => {
  assert.doesNotThrow(() =>
    validateEventPayload(
      payload({
        start_date: "2024-01-01",
        end_date: "2024-12-31",
        time_mode: "all_day",
        start_time: "",
        end_time: "",
      }),
    ),
  );
  for (const extra of [
    { start_date: "2025-02-29" },
    { start_time: "25:00" },
    { end_time: "19:00" },
    { end_date: "2028-01-05" },
    { time_mode: "undecided" },
    { end_date: "2027-01-03" },
  ])
    assert.throws(() => validateEventPayload(payload(extra)));
});
test("week projection supports multiple items per day and cross-week periods without silent clipping", () => {
  const a = validateEventPayload(
      payload({ title: "첫 방송", start_time: "20:00", end_time: "21:00" }),
    ),
    b = validateEventPayload(
      payload({ title: "다음 방송", start_time: "22:00", end_time: "23:00" }),
    ),
    span = validateEventPayload(
      payload({
        title: "기간 휴방",
        kind: "off",
        time_mode: "all_day",
        start_date: "2027-01-03",
        end_date: "2027-01-05",
        start_time: "",
        end_time: "",
      }),
    );
  const result = projectEventsToWeek([a, b, span], "2027-01-04");
  assert.equal(result.mon.time, "일정 3개");
  assert.ok(result.mon.content.includes("20:00–21:00 첫 방송"));
  assert.equal(result.tue.content, "기간 휴방");
  assert.equal(result.wed.content, "");
  assert.throws(
    () =>
      projectEventsToWeek(
        Array.from({ length: 5 }, () =>
          validateEventPayload(payload({ title: "긴".repeat(120) })),
        ),
        "2027-01-04",
      ),
    /길이/,
  );
});
test("incomplete event drafts remain recoverable while corrupt structures are rejected", () => {
  assert.equal(isEventDraft({ revision: 0, form: emptyEvent("") }), true);
  assert.equal(
    isEventDraft({
      revision: 1,
      form: { ...emptyEvent("2027-01-04"), end_time: "" },
    }),
    true,
  );
  for (const value of [
    { revision: -1, form: emptyEvent("") },
    { revision: 1, form: { ...emptyEvent(""), title: {} } },
    { revision: 1, form: { ...emptyEvent(""), extra: true } },
    { revision: 1, form: [], token: "bad" },
  ])
    assert.equal(isEventDraft(value), false);
});
test("individual event backup validates every item and rejects mixed weekly backups and hidden data", () => {
  const data = {
    format: "zio-schedule-events",
    version: 1,
    exported_at: new Date().toISOString(),
    events: [payload()],
  };
  assert.deepEqual(validateEventBackup(data), data);
  for (const value of [
    { ...data, version: 2 },
    { ...data, events: [{ ...payload(), id: 1 }] },
    { ...data, token: "secret" },
    { ...data, events: [payload({ end_time: "99:00" })] },
    { version: 1, weeks: [] },
  ])
    assert.throws(() => validateEventBackup(value));
});
