import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultNavigation,
  validateNavigation,
  validateMenuLink,
  publicNavigation,
  moveMenu,
  isNavigationDraft,
} from "../shared/navigation.js";
import {
  activeNavigation,
  administrationLinks,
} from "../src/services/admin-navigation.js";
test("default menus are independent, validated and keep management outside configurable entries", () => {
  const first = defaultNavigation(),
    second = defaultNavigation();
  first[0].label = "다른 홈";
  assert.equal(second[0].label, "홈");
  assert.deepEqual(validateNavigation(second), second);
  assert.equal(
    second.some((item) => item.href === "/admin/menus"),
    false,
  );
  assert.deepEqual(
    administrationLinks.map((item) => item.id),
    ["accounts", "menus"],
  );
});
test("menu links normalize HTTPS and reject script, credentials, spaces and non-HTTPS schemes", () => {
  assert.equal(validateMenuLink("https://example.com"), "https://example.com/");
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,a",
    "http://example.com",
    "//example.com",
    "https://user@example.com",
    "https://user:pass@example.com",
    "https://example.com/\nnext",
    "https://example.com/a b",
  ])
    assert.throws(() => validateMenuLink(href));
});
test("menu ordering moves only within one location and keeps the original collection intact", () => {
  const items = defaultNavigation(),
    snapshot = JSON.stringify(items),
    moved = moveMenu(items, "songs", 1);
  assert.deepEqual(
    publicNavigation(moved)
      .filter((item) => item.area === "public")
      .map((item) => item.id),
    ["home", "about", "songs"],
  );
  assert.equal(JSON.stringify(items), snapshot);
  assert.deepEqual(moveMenu(items, "home", -1), items);
  assert.deepEqual(
    moveMenu(items, "manage", 1)
      .filter((item) => item.area === "work")
      .map((item) => item.id),
    ["schedule", "manage"],
  );
});
test("menu recovery retains exact versions and rejects altered structures or unsafe drafts", () => {
  const value = { items: defaultNavigation(), revision: 0 };
  assert.equal(isNavigationDraft(value), true);
  for (const invalid of [
    { ...value, revision: -1 },
    { ...value, revision: "0" },
    { ...value, token: "secret" },
    { ...value, items: [] },
    null,
  ])
    assert.equal(isNavigationDraft(invalid), false);
});
test("active menu follows administrator hierarchy and public introduction independently", () => {
  for (const [path, expected] of [
    ["/admin", "administration"],
    ["/admin/menus", "menus"],
    ["/admin/users", "accounts"],
    ["/admin/password-reset", "accounts"],
    ["/admin/songs/1/edit", "manage"],
    ["/admin/schedule/image", "schedule"],
    ["/about", "about"],
  ])
    assert.equal(activeNavigation(path), expected);
});
