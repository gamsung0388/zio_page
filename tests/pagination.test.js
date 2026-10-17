import { test } from "node:test";
import assert from "node:assert/strict";
import { pageCount, queryPage } from "../shared/pagination.js";
test("shared page parsing rejects arrays, overflow and malformed query values", () => {
  for (const value of [
    undefined,
    ["2"],
    "0",
    "-1",
    "1.5",
    "10001",
    "Infinity",
    "2x",
  ])
    assert.equal(queryPage(value), 1);
  assert.equal(queryPage("42"), 42);
  assert.equal(pageCount(2051, 50), 42);
  assert.equal(pageCount(0, 50), 1);
});
