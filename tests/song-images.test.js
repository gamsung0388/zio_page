import { test } from "node:test";
import assert from "node:assert/strict";
import { coverImage } from "./fixtures/song-image.js";
import {
  validateCoverImage,
  coverBytes,
  COVER_PREFIX,
} from "../shared/song-image.js";
import { readSongBackup } from "../shared/song-backup.js";
import {
  songReviewRows,
  mergeSongReview,
  songReviewValue,
} from "../src/services/song-review.js";
test("cover bytes require a bounded still WebP container and reject spoofing, broken chunks and large dimensions", () => {
  assert.equal(validateCoverImage(coverImage), coverImage);
  assert.equal(validateCoverImage(null), null);
  const original = coverBytes(coverImage);
  const corrupt = (change) => {
    const bytes = original.slice();
    change(bytes);
    return COVER_PREFIX + Buffer.from(bytes).toString("base64");
  };
  for (const value of [
    undefined,
    "",
    coverImage + "AAAA",
    corrupt((b) => (b[4] = 0)),
    corrupt((b) => b.fill(255, 16, 20)),
    corrupt((b) => (b[20] |= 2)),
    corrupt((b) => (b[24] = 255)),
    corrupt((b) => (b[25] = 255)),
    corrupt((b) => {
      const at = Buffer.from(b).indexOf("VP8 ");
      b[at + 14] = 255;
      b[at + 15] = 15;
    }),
  ])
    assert.throws(() => validateCoverImage(value));
});
test("backup and conflict review preserve uploaded image removal and never render binary text as a label", () => {
  const song = {
    title: "사진",
    artist: "가수",
    description: "",
    genre: "",
    language: "",
    proficiency: 1,
    practice_status: "not_started",
    balloon_cost: 0,
    memo: "비공개",
    is_public: false,
    cover_image: coverImage,
  };
  const backup = {
    format: "zio-songbook",
    version: 1,
    exported_at: new Date().toISOString(),
    songs: [song],
  };
  assert.equal(readSongBackup(backup)[0].cover_image, coverImage);
  assert.throws(() =>
    readSongBackup({
      ...backup,
      songs: [{ ...song, cover_image: "data:image/svg+xml,bad" }],
    }),
  );
  const rows = songReviewRows(
    { coverImage },
    { coverImage: null },
    { coverImage, revision: 2 },
  );
  assert.equal(rows[0].key, "coverImage");
  assert.equal(
    mergeSongReview({ coverImage: null }, { revision: 2 }, rows).coverImage,
    null,
  );
  assert.equal(songReviewValue(coverImage), "직접 등록한 앨범 사진");
});
