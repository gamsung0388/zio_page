import { test } from "node:test";
import assert from "node:assert/strict";
import {
  songReviewRows,
  mergeSongReview,
} from "../src/services/song-review.js";
import { isSongDraft } from "../src/services/song-draft.js";
test("song review preserves independent changes and requires an explicit choice for conflicting fields", () => {
  const base = {
    title: "원래 제목",
    artist: "원래 가수",
    privateMemo: "비공개",
    isPublic: true,
  };
  const draft = { ...base, title: "내 제목", artist: "내 가수" };
  const latest = {
    ...base,
    title: "저장된 제목",
    privateMemo: "저장된 비공개",
    revision: 3,
  };
  const rows = songReviewRows(base, draft, latest);
  assert.equal(rows.find((row) => row.key === "title").selection, "");
  assert.equal(rows.find((row) => row.key === "artist").selection, "mine");
  assert.equal(
    rows.find((row) => row.key === "privateMemo").selection,
    "latest",
  );
  assert.throws(() => mergeSongReview(draft, latest, rows), /선택/);
  rows.find((row) => row.key === "title").selection = "mine";
  const merged = mergeSongReview(draft, latest, rows);
  assert.equal(merged.title, "내 제목");
  assert.equal(merged.artist, "내 가수");
  assert.equal(merged.privateMemo, "저장된 비공개");
  assert.equal(merged.sourceRevision, 3);
  assert.equal(draft.privateMemo, "비공개");
  const unknownBase = songReviewRows(null, draft, latest);
  assert.ok(unknownBase.every((row) => row.conflict && row.selection === ""));
  assert.throws(() => mergeSongReview(draft, latest, unknownBase), /선택/);
});
test("song drafts support old snapshots and retain the exact revision for stale edit detection", () => {
  const draft = {
    title: "",
    artist: "",
    genre: "",
    language: "",
    description: "",
    privateMemo: "",
    cover: "",
    level: 0,
    practiceStatus: "미연습",
    balloonCount: 0,
    isPublic: true,
    links: [],
    sourceUpdatedAt: null,
  };
  assert.equal(isSongDraft(draft), true);
  assert.equal(isSongDraft({ ...draft, sourceRevision: 1 }), true);
  for (const sourceRevision of [-1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1])
    assert.equal(isSongDraft({ ...draft, sourceRevision }), false);
});
