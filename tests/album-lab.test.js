import { test } from "node:test";
import assert from "node:assert/strict";
import { ALBUM_LAB_PATH, isAlbumLabOwner } from "../shared/album-lab.js";
import { catalogQuery, catalogUrl } from "../shared/catalog-query.js";
import { safeReturnTo } from "../src/services/return-to.js";
import { readConfig } from "../scripts/deploy-config.js";
test("lab is limited to the named account and its document route is handled by the Worker", () => {
  assert.equal(isAlbumLabOwner(null), false);
  assert.equal(isAlbumLabOwner({ username: "someone" }), false);
  assert.equal(
    isAlbumLabOwner({ username: "admin", must_change_password: true }),
    false,
  );
  assert.equal(
    isAlbumLabOwner({ username: "admin", must_change_password: false }),
    true,
  );
  assert.equal(safeReturnTo(ALBUM_LAB_PATH), ALBUM_LAB_PATH);
  assert.equal(safeReturnTo(ALBUM_LAB_PATH + "/../users"), "");
  assert.ok(readConfig().assets.run_worker_first.includes(ALBUM_LAB_PATH));
});
test("catalogue requests share strict fields and a fixed HTTPS provider URL", () => {
  const input = { q: "  검은행복 & #?  ", country: "US" };
  assert.deepEqual(catalogQuery(input), { q: "검은행복 & #?", country: "US" });
  const url = new URL(catalogUrl(input));
  assert.equal(url.origin, "https://itunes.apple.com");
  assert.equal(url.pathname, "/search");
  assert.equal(url.searchParams.get("term"), "검은행복 & #?");
  assert.equal(url.searchParams.get("limit"), "10");
  for (const bad of [
    null,
    [],
    { ...input, q: " " },
    { ...input, country: "us" },
    { ...input, provider: "evil" },
    { ...input, q: "a".repeat(201) },
  ])
    assert.throws(() => catalogQuery(bad));
});
