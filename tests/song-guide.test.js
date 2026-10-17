import { test } from "node:test";
import assert from "node:assert/strict";
import {
  songGuideReturnTo,
  songGuideLink,
} from "../src/services/song-guide.js";

test("song guide keeps exact list filters and editor destinations", () => {
  for (const path of [
    "/songs",
    "/songs?q=%EC%A7%80%EC%98%A4&sort=title_asc&page=2&language=%ED%95%9C%EA%B5%AD%EC%96%B4",
  ])
    assert.equal(songGuideReturnTo(path), path);
  for (const path of [
    "/admin/songs?q=ballad&page=3&is_public=false",
    "/admin/songs/new?returnTo=%2Fadmin%2Fsongs%3Fpage%3D2",
    "/admin/songs/123/edit?returnTo=%2Fadmin%2Fsongs",
  ])
    assert.equal(songGuideReturnTo(path, true), path);
});

test("guide return links reject external addresses, traversal, unexpected routes and loops", () => {
  for (const value of [
    undefined,
    {},
    ["/songs"],
    "https://evil.test/songs",
    "//evil.test/songs",
    "/songs/guide",
    "/songs/1",
    "/x/../songs",
    "/%73ongs",
    "/songs#x",
    "/songs\\evil",
    "/songs\n",
    "/songs?x=" + "a".repeat(2048),
  ])
    assert.equal(songGuideReturnTo(value), "/songs");
  for (const value of [
    undefined,
    {},
    ["/admin/songs"],
    "https://evil.test/admin/songs",
    "//evil.test/admin/songs",
    "/admin/songs/guide",
    "/admin/menus",
    "/admin/songs/0/edit",
    "/x/../admin/songs",
    "/admin/%73ongs",
    "/admin/songs#x",
    "/admin/songs\\evil",
    "/admin/songs\n",
    "/admin/songs?x=" + "a".repeat(2048),
  ])
    assert.equal(songGuideReturnTo(value, true), "/admin/songs");
});

test("guide entry always targets its own public or protected guide", () => {
  assert.deepEqual(songGuideLink("/songs?q=test"), {
    path: "/songs/guide",
    query: { returnTo: "/songs?q=test" },
  });
  assert.deepEqual(songGuideLink("/admin/songs/new", true), {
    path: "/admin/songs/guide",
    query: { returnTo: "/admin/songs/new" },
  });
  assert.deepEqual(songGuideLink("https://evil.test", true), {
    path: "/admin/songs/guide",
    query: { returnTo: "/admin/songs" },
  });
});
