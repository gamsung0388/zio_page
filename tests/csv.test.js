import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, stringifyCSV, escapeCSV } from "../server/services/csv.js";
import {
  validateSong,
  parseFilters,
} from "../server/services/song-validation.js";

test("CSV handles BOM, CRLF, commas, quotes and embedded newlines", () => {
  const parsed = parseCSV(
    '\uFEFFtitle,artist\r\n"노래, 하나","가수 ""A"""\r\n"두\n줄",B\r\n',
  );
  assert.deepEqual(parsed[1], { line: 2, values: ["노래, 하나", '가수 "A"'] });
  assert.deepEqual(parsed[2], { line: 3, values: ["두\n줄", "B"] });
});
test("CSV rejects malformed quote grammar and excessive rows", () => {
  for (const csv of ['a,b\n"unfinished,b', 'a,b\n"closed"bad,b', 'a,b\na"b,c'])
    assert.throws(() => parseCSV(csv));
  assert.throws(() => parseCSV("a\n" + "x\n".repeat(1001)), /최대/);
});
test("CSV neutralizes spreadsheet formula injection and includes BOM", () => {
  for (const value of [
    "=1+1",
    "+cmd",
    "-1",
    "@SUM(A1)",
    "  =1",
    "\t=1",
    "\rtext",
  ])
    assert.ok(escapeCSV(value).startsWith("\"'"));
  assert.equal(escapeCSV('ordinary "text"'), '"ordinary ""text"""');
  assert.ok(stringifyCSV([]).startsWith("\uFEFFtitle,artist"));
});
test("song validation rejects unknown fields, unsafe numbers and nonboolean visibility", () => {
  for (const changes of [
    { proficiency: 6 },
    { practice_status: "bogus" },
    { balloon_cost: -1 },
    { balloon_cost: Number.MAX_SAFE_INTEGER + 1 },
    { is_public: 1 },
    { id: 99 },
  ]) {
    assert.throws(() =>
      validateSong({ title: "곡", artist: "가수", ...changes }),
    );
  }
  assert.throws(() => validateSong({}, true));
  assert.deepEqual(validateSong({ proficiency: 5 }, true), { proficiency: 5 });
});
test("filters enforce sort and page allowlists including prototype keys", () => {
  for (const query of [
    "sort=title;DROP TABLE songs",
    "sort=constructor",
    "page_size=101",
    "page=0",
    "proficiency=6",
    "practice_status=unknown",
  ])
    assert.throws(() => parseFilters(new URLSearchParams(query)));
  assert.equal(parseFilters(new URLSearchParams()).page_size, 20);
});
