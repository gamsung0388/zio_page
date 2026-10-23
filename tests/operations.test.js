import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAlbum, catalogCandidates } from "../shared/album.js";
import { validateProfile, DEFAULT_PROFILE } from "../shared/site-profile.js";
import {
  songReviewRows,
  mergeSongReview,
} from "../src/services/song-review.js";
import { toSongView, toSongInput } from "../src/services/song-adapter.js";
const album = {
  provider: "itunes",
  track_id: 1,
  storefront: "US",
  title: "Original",
  artist: "Artist",
  album_title: "Album",
  artwork_url: "https://is1-ssl.mzstatic.com/image/100x100bb.jpg",
  source_url: "https://music.apple.com/us/album/a/2?i=1",
};
test("album catalogue rejects unsafe artwork, source mismatch and non-song candidates without changing trusted fields", () => {
  assert.deepEqual(validateAlbum(album), album);
  for (const value of [
    { ...album, artwork_url: "https://is1-ssl.mzstatic.com.evil.test/a" },
    { ...album, source_url: "https://user:password@music.apple.com/a?i=1" },
    { ...album, track_id: 2 },
    { ...album, artwork_url: "data:image/svg+xml,bad" },
    { ...album, provider: "unknown" },
  ])
    assert.throws(() => validateAlbum(value));
  assert.equal(validateAlbum(null), null);
  assert.deepEqual(
    catalogCandidates(
      { results: [{ kind: "song", wrapperType: "collection" }] },
      "US",
    ),
    [],
  );
});
test("album conflicts compare values rather than object identities and preserve explicit unlink selections", () => {
  const base = { album },
    draft = { album: structuredClone(album) },
    latest = { album: structuredClone(album), revision: 2 };
  assert.deepEqual(songReviewRows(base, draft, latest), []);
  const rows = songReviewRows(
    base,
    { album: null },
    { album: { ...album, album_title: "New" }, revision: 3 },
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].conflict, true);
  rows[0].selection = "mine";
  assert.equal(
    mergeSongReview({ album: null }, { revision: 3 }, rows).album,
    null,
  );
  assert.deepEqual(songReviewRows({}, {}, { album: null }), []);
});
test("album adapters retain local titles, metadata, and real covers while omitting internal notes publicly", () => {
  const row = {
    id: 1,
    title: "한국어 제목",
    artist: "한국어 이름",
    genre: "발라드",
    proficiency: 3,
    practice_status: "practicing",
    balloon_cost: 2,
    is_public: true,
    memo: "SECRET",
    album,
  };
  const view = toSongView(row);
  assert.equal(view.title, row.title);
  assert.equal(view.cover, album.artwork_url);
  assert.ok(!("privateMemo" in view));
  assert.deepEqual(
    toSongInput(toSongView(row, { admin: true }), { admin: true }).album,
    album,
  );
});
test("profile settings restrict fields, HTTPS links, size and featured identities", () => {
  assert.deepEqual(validateProfile(DEFAULT_PROFILE), DEFAULT_PROFILE);
  for (const value of [
    { ...DEFAULT_PROFILE, intro_title: "" },
    { ...DEFAULT_PROFILE, featured_ids: [1, 1] },
    { ...DEFAULT_PROFILE, featured_ids: [1, 2, 3, 4, 5] },
    {
      ...DEFAULT_PROFILE,
      social_links: [{ label: "Unsafe", href: "http://example.com/" }],
    },
    {
      ...DEFAULT_PROFILE,
      social_links: [{ label: "Unsafe", href: "https://a:b@example.com/" }],
    },
    { ...DEFAULT_PROFILE, css: "unsafe" },
  ])
    assert.throws(() => validateProfile(value));
});

test("JSON backup restoration preserves album and private text and rejects mixed or malformed records", async () => {
  const { readSongBackup } = await import("../shared/song-backup.js");
  const song = {
    title: "한국어 제목",
    artist: "가수",
    description: "설명",
    genre: "발라드",
    language: "한국어",
    proficiency: 3,
    practice_status: "practicing",
    balloon_cost: 2,
    memo: "PRIVATE",
    is_public: true,
    album,
  };
  const file = {
    format: "zio-songbook",
    version: 1,
    exported_at: new Date().toISOString(),
    songs: [song],
  };
  assert.deepEqual(readSongBackup(file), [song]);
  for (const invalid of [
    { ...file, version: 2 },
    {
      ...file,
      songs: [
        {
          ...song,
          album: { ...album, source_url: "https://unsafe.test/?i=1" },
        },
      ],
    },
    { ...file, songs: [{ ...song, password: "SECRET" }] },
    { ...file, songs: [{ ...song, proficiency: 0 }] },
    { ...file, songs: [{ ...song, is_public: 1 }] },
  ])
    assert.throws(() => readSongBackup(invalid));
});
