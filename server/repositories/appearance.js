import { DEFAULT_THEME, validateAppearance } from "../../shared/appearance.js";
import { readSetting, writeSetting } from "./versioned-setting.js";
const KEY = "appearance.v1";
function serialize(row) {
  if (!row) return { theme: DEFAULT_THEME, revision: 0, updated_at: null };
  const value = JSON.parse(row.value);
  const { theme } = validateAppearance({ theme: value.theme });
  if (!Number.isSafeInteger(value.revision) || value.revision < 1)
    throw Error("Invalid appearance revision");
  return { theme, revision: value.revision, updated_at: row.updated_at };
}
export async function getAppearance(db) {
  return serialize(await readSetting(db, KEY));
}
export async function saveAppearance(db, appearance, revision) {
  const row = await writeSetting(db, KEY, appearance, revision);
  return row ? serialize(row) : null;
}
