import { test } from "node:test";
import assert from "node:assert/strict";
import { singleFlight } from "../src/services/single-flight.js";
test("simultaneous session checks share a request but the next navigation checks again", async () => {
  let calls = 0,
    resolve;
  const check = singleFlight(() => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const first = check(),
    second = check();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(calls, 1);
  resolve(true);
  assert.equal(await first, true);
  const next = check();
  await Promise.resolve();
  assert.equal(calls, 2);
  resolve(false);
  assert.equal(await next, false);
});
test("failed session checks can be retried and do not retain stale successful authorization", async () => {
  let calls = 0;
  const check = singleFlight(() => {
    if (++calls === 1) throw new Error("offline");
    return false;
  });
  await assert.rejects(check(), /offline/);
  assert.equal(await check(), false);
  assert.equal(calls, 2);
});
