import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todayKst,
  isDate,
  addDays,
  mondayOf,
  shiftMonth,
  monthDates,
} from "../shared/schedule/dates.js";
import {
  createScheduleForm,
  createEditorOptions,
  normalizeTemplate,
} from "../shared/schedule/scheduleFactory.js";
import { DEFAULT_TEMPLATE } from "../shared/schedule/scheduleConfig.js";
import { waitForImage } from "../src/schedule/imageLoading.js";
test("calendar dates handle leap days, year transitions and Monday-based six-week grids", () => {
  assert.equal(isDate("2024-02-29"), true);
  assert.equal(isDate("2025-02-29"), false);
  assert.equal(isDate("2026-13-01"), false);
  assert.equal(isDate(["2026-01-01"]), false);
  assert.equal(mondayOf("2026-01-01"), "2025-12-29");
  assert.equal(mondayOf("2026-10-18"), "2026-10-12");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(shiftMonth("2025-12", 1), "2026-01");
  const grid = monthDates("2026-10");
  assert.equal(grid.length, 42);
  assert.equal(grid[0], "2026-09-28");
  assert.equal(grid.at(-1), "2026-11-08");
  assert.equal(new Set(grid).size, 42);
});
test("Korean today changes at 15:00 UTC independently of browser timezone", () => {
  assert.equal(todayKst(new Date("2026-10-15T14:59:59Z")), "2026-10-15");
  assert.equal(todayKst(new Date("2026-10-15T15:00:00Z")), "2026-10-16");
});
test("copied schedule factories keep independent days and reject inherited template/options", () => {
  const form = createScheduleForm();
  form.mon.content = "수정";
  assert.equal(form.tue.content, "");
  assert.equal(createScheduleForm().mon.content, "");
  assert.equal(normalizeTemplate("__proto__"), DEFAULT_TEMPLATE);
  assert.equal(normalizeTemplate("toString"), DEFAULT_TEMPLATE);
  assert.equal(
    createEditorOptions({ contentFontSize: 999 }).contentFontSize,
    42,
  );
  assert.equal("extra" in createEditorOptions({ extra: true }), false);
});
class ImageStub extends EventTarget {
  complete = false;
  naturalWidth = 0;
  listeners = 0;
  addEventListener(...args) {
    this.listeners++;
    super.addEventListener(...args);
  }
  removeEventListener(...args) {
    this.listeners--;
    super.removeEventListener(...args);
  }
}
test("image export waits for uncached templates and cleans up successful listeners", async () => {
  const image = new ImageStub(),
    loading = waitForImage(image, 50);
  image.naturalWidth = 1672;
  image.dispatchEvent(new Event("load"));
  await loading;
  assert.equal(image.listeners, 0);
});
test("failed and stalled image exports reject instead of emitting blank images", async () => {
  const cached = new ImageStub();
  cached.complete = true;
  await assert.rejects(waitForImage(cached, 50), /불러오지/);
  assert.equal(cached.listeners, 0);
  const stalled = new ImageStub();
  await assert.rejects(waitForImage(stalled, 10), /초과/);
  assert.equal(stalled.listeners, 0);
});
