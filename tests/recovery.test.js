import { test } from "node:test";
import assert from "node:assert/strict";
import { safeReturnTo } from "../src/services/return-to.js";
import {
  readDraft,
  writeDraft,
  removeDraft,
  clearUserDrafts,
  draftKey,
} from "../src/services/draft-storage.js";
import {
  validateScheduleBackup,
  validateSchedulePayload,
} from "../shared/schedule/validation.js";
import {
  createScheduleForm,
  createEditorOptions,
} from "../shared/schedule/scheduleFactory.js";
import { DEFAULT_TEMPLATE } from "../shared/schedule/scheduleConfig.js";
function storage() {
  const values = {};
  return {
    getItem: (key) => values[key] ?? null,
    setItem(key, value) {
      values[key] = value;
      this[key] = value;
    },
    removeItem(key) {
      delete values[key];
      delete this[key];
    },
  };
}
const payload = () => ({
  selectedTemplate: DEFAULT_TEMPLATE,
  scheduleForm: createScheduleForm(),
  editorOptions: createEditorOptions(),
});
test("login returns only to canonical known admin routes and preserves their query", () => {
  for (const path of [
    "/admin",
    "/admin/songs/12/edit?returnTo=%2Fadmin%2Fsongs",
    "/admin/schedule/image?week=2027-01-04",
    "/admin/schedule/guide?month=2027-01&view=list",
    "/admin/password",
  ])
    assert.equal(safeReturnTo(path), path);
  for (const path of [
    "https://evil.test/admin",
    "//evil.test/admin",
    "/admin/login",
    "/songs",
    "/admin/../admin",
    "/admin/%73ongs",
    "/admin\\songs",
    "/admin#x",
    "/admin\n",
    {},
    ["/admin"],
  ])
    assert.equal(safeReturnTo(path), "");
});
test("drafts are separated by user and editing target, with bounded lifetime", () => {
  const data = storage(),
    now = 100000000;
  assert.equal(writeDraft(data, 1, "song:new", { memo: "private" }, now), true);
  assert.equal(readDraft(data, 1, "song:new", now).value.memo, "private");
  assert.equal(readDraft(data, 2, "song:new", now), null);
  assert.equal(readDraft(data, 1, "song:1", now), null);
  assert.equal(readDraft(data, 1, "song:new", now + 86400001), null);
  assert.equal(data.getItem(draftKey(1, "song:new")), null);
});
test("corrupt or oversized drafts do not block editing; logout clears only the current owner", () => {
  const data = storage();
  data.setItem(draftKey(1, "bad"), "{bad");
  assert.equal(readDraft(data, 1, "bad"), null);
  assert.equal(
    writeDraft(data, 1, "large", { text: "a".repeat(100001) }),
    false,
  );
  writeDraft(data, 1, "song:new", {});
  writeDraft(data, 1, "day:2027-01-04", {});
  writeDraft(data, 2, "song:new", {});
  clearUserDrafts(data, 1);
  assert.equal(readDraft(data, 1, "song:new"), null);
  assert.ok(readDraft(data, 2, "song:new"));
  removeDraft(data, 2, "song:new");
  assert.equal(readDraft(data, 2, "song:new"), null);
  const denied = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
  assert.equal(writeDraft(denied, 1, "song:new", {}), false);
  assert.equal(readDraft(denied, 1, "song:new"), null);
});
test("backup validation is lossless and rejects malformed dates, duplicates, hidden fields and unknown templates", () => {
  const week = { week_start: "2027-01-04", ...payload() };
  week.scheduleForm.mon.content = "노래 방송\n함께해요";
  week.scheduleForm.mon.time = "미정";
  const valid = {
    version: 1,
    exported_at: "2026-10-16T12:00:00Z",
    weeks: [week],
  };
  assert.deepEqual(validateScheduleBackup(valid), valid);
  for (const value of [
    { ...valid, version: 2 },
    { ...valid, weeks: [week, week] },
    { ...valid, weeks: [{ ...week, week_start: "2027-01-05" }] },
    { ...valid, weeks: [{ ...week, revision: 1 }] },
    {
      ...valid,
      weeks: [{ ...week, selectedTemplate: "https://remote.test/image.png" }],
    },
    { ...valid, token: "secret" },
  ])
    assert.throws(() => validateScheduleBackup(value));
  const tooLong = payload();
  tooLong.scheduleForm.mon.time = "시".repeat(41);
  assert.throws(() => validateSchedulePayload(tooLong));
  const size = payload();
  size.editorOptions.contentFontSize = 43;
  assert.throws(() => validateSchedulePayload(size));
});

test("song recovery keeps incomplete numeric inputs and rejects structurally corrupt drafts", async () => {
  const { isSongDraft } = await import("../src/services/song-draft.js");
  const draft = {
    title: "작성 중인 곡",
    artist: "",
    genre: "가요",
    language: "",
    description: "",
    privateMemo: "private",
    cover: "",
    level: 0,
    practiceStatus: "미연습",
    balloonCount: "",
    isPublic: true,
    links: [],
    sourceUpdatedAt: null,
  };
  assert.equal(isSongDraft(draft), true);
  assert.equal(isSongDraft({ ...draft, balloonCount: 1.5 }), true);
  for (const value of [
    { ...draft, links: [null] },
    { ...draft, links: [{ label: "YouTube", url: 123 }] },
    { ...draft, privateMemo: {} },
    { ...draft, isPublic: "true" },
    { ...draft, extra: 1 },
    { ...draft, balloonCount: null },
  ])
    assert.equal(isSongDraft(value), false);
});
