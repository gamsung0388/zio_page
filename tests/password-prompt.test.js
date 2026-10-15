import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import password from "@inquirer/password";
import { render } from "@inquirer/testing";
import {
  validatePasswordLength,
  newPasswordOptions,
  confirmationOptions,
} from "../scripts/password-prompt.js";

test("admin password input enforces explicit length boundaries", () => {
  assert.match(validatePasswordLength("x".repeat(7)), /8자 이상/);
  assert.equal(validatePasswordLength("x".repeat(8)), true);
  assert.equal(validatePasswordLength("x".repeat(256)), true);
  assert.match(validatePasswordLength("x".repeat(257)), /256자 이하/);
});
test("masked password prompt retries short input and never prints the password", async () => {
  const ui = await render(password, newPasswordOptions());
  ui.events.type("short");
  ui.events.keypress("enter");
  await ui.nextRender();
  assert.match(ui.getScreen(), /8자 이상/);
  for (let i = 0; i < 5; i++) ui.events.keypress("backspace");
  const value = randomBytes(4).toString("hex");
  ui.events.type(value);
  assert.ok(!ui.getScreen().includes(value));
  ui.events.keypress("enter");
  assert.equal(await ui.answer, value);
  assert.ok(!ui.getScreen().includes(value));
});
test("confirmation prompt distinguishes mismatch and allows correcting the same prompt", async () => {
  const value = randomBytes(12).toString("hex");
  const ui = await render(password, confirmationOptions(value));
  const incorrect = randomBytes(12).toString("hex");
  ui.events.type(incorrect);
  ui.events.keypress("enter");
  await ui.nextRender();
  assert.match(ui.getScreen(), /두 비밀번호가 다릅니다/);
  assert.ok(!ui.getScreen().includes(incorrect));
  for (let i = 0; i < incorrect.length; i++) ui.events.keypress("backspace");
  ui.events.type(value);
  ui.events.keypress("enter");
  assert.equal(await ui.answer, value);
  assert.ok(!ui.getScreen().includes(value));
});
