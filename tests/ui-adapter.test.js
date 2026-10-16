import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toSongView,
  toSongInput,
  validateDraft,
} from "../src/ui-preview/song-adapter.js";
const original = {
  id: 1,
  title: "노래",
  artist: "가수",
  genre: "",
  language: "한국어",
  description: "설명",
  proficiency: 4,
  practice_status: "on_hold",
  balloon_cost: 7,
  is_public: 1,
  memo: "PRIVATE",
  created_at: "2026-10-16",
  updated_at: "2026-10-16",
};
test("preview adapter omits private memo unless explicitly used for an admin editor", () => {
  assert.equal("privateMemo" in toSongView(original), false);
  assert.equal(toSongView(original, { admin: true }).privateMemo, "PRIVATE");
});
test("preview adapter retains API states and emits only supported song fields", () => {
  const view = toSongView(original, { admin: true });
  assert.equal(view.practiceStatus, "잠시 보류");
  const input = toSongInput(
    { ...view, cover: "preview-only", links: [{ url: "https://example.com" }] },
    { admin: true },
  );
  assert.equal(input.practice_status, "on_hold");
  assert.equal(input.genre, "");
  assert.equal(input.memo, "PRIVATE");
  assert.equal("cover" in input, false);
  assert.equal("links" in input, false);
  assert.equal("memo" in toSongInput(view), false);
});
test("shared preview editor enforces safe wind counts, five proficiency levels and real practice states", () => {
  const view = toSongView(original, { admin: true });
  assert.deepEqual(validateDraft(view), []);
  assert.ok(validateDraft({ ...view, level: 0 }).length);
  assert.ok(validateDraft({ ...view, balloonCount: 2 ** 53 }).length);
  assert.ok(validateDraft({ ...view, practiceStatus: "toString" }).length);
});
