import { test } from "node:test";
import assert from "node:assert/strict";
import {
  THEME_OPTIONS,
  DEFAULT_THEME,
  isTheme,
  validateAppearance,
  resolveTheme,
} from "../shared/appearance.js";
import { safeReturnTo } from "../src/services/return-to.js";
test("appearance accepts only supported presets and rejects arbitrary CSS, URLs and extra settings", () => {
  assert.equal(new Set(THEME_OPTIONS.map((t) => t.id)).size, 3);
  for (const t of THEME_OPTIONS)
    assert.deepEqual(validateAppearance({ theme: t.id }), { theme: t.id });
  for (const value of [
    null,
    [],
    {},
    { theme: "evil" },
    { theme: "forest", css: "x" },
    { theme: "url(javascript:evil)" },
  ])
    assert.throws(() => validateAppearance(value));
  assert.equal(isTheme(null), false);
});
test("temporary admin preview and visitor preferences resolve independently with safe fallbacks", () => {
  assert.equal(resolveTheme("garden", "starlight", null), "garden");
  assert.equal(resolveTheme("site", "starlight", null), "starlight");
  assert.equal(resolveTheme("garden", "starlight", "forest"), "forest");
  assert.equal(resolveTheme("site", "unknown", null), DEFAULT_THEME);
  assert.equal(safeReturnTo("/admin/appearance"), "/admin/appearance");
  assert.equal(safeReturnTo("//example.com/admin/appearance"), "");
});
