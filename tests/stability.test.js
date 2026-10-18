import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importTask,
  completeImportTask,
  fileHash,
} from "../src/services/csv-import-task.js";
import { songListHasFilters, songListEmptyInfo } from "../shared/song-list.js";
import { validateDraft } from "../src/services/song-adapter.js";
import { validateSong } from "../server/services/song-validation.js";

function memory() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
    values: entries,
  };
}
test("pending CSV operations survive reopening, remain scoped to owner and bytes, and clear only on success", async () => {
  const storage = memory(),
    hash = await fileHash(new Blob(["same file"]));
  assert.equal(hash.length, 64);
  assert.equal(await fileHash(new Blob(["same file"])), hash);
  const first = importTask(storage, 1, hash);
  assert.equal(importTask(storage, 1, hash).key, first.key);
  assert.notEqual(importTask(storage, 2, hash).key, first.key);
  assert.notEqual(
    importTask(storage, 1, await fileHash(new Blob(["other file"]))).key,
    first.key,
  );
  assert.ok(
    [...storage.values.values()].every((value) => !value.includes("same file")),
  );
  completeImportTask(storage, 1, first);
  assert.notEqual(importTask(storage, 1, hash).key, first.key);
  assert.equal(importTask(null, 1, hash).persisted, false);
});
test("public and admin empty messages distinguish active filters while public ignores private-only parameters", () => {
  assert.equal(songListHasFilters({ is_public: "false" }), false);
  assert.equal(songListHasFilters({ is_public: "false" }, true), true);
  assert.equal(songListHasFilters({ q: "곡", sort: "recent" }), true);
  assert.match(songListEmptyInfo(true).title, /검색 조건/);
  assert.match(songListEmptyInfo(false, true).title, /등록된 노래/);
});
test("the shared song limits reject the same oversized title in the form and on the server", () => {
  const title = "가".repeat(201);
  assert.throws(() => validateSong({ title, artist: "가수" }));
  const errors = validateDraft({
    title,
    artist: "가수",
    genre: "",
    language: "",
    description: "",
    privateMemo: "",
    level: 3,
    practiceStatus: "미연습",
    balloonCount: 0,
  });
  assert.ok(errors.some((message) => message.startsWith("곡명")));
});
