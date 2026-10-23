import { DEFAULT_PROFILE, validateProfile } from "../../shared/site-profile.js";
import { readSetting, writeSetting } from "./versioned-setting.js";
import { getNavigation } from "./navigation.js";
const KEY = "profile.v1";
function serialize(row) {
  if (!row)
    return {
      profile: structuredClone(DEFAULT_PROFILE),
      revision: 0,
      updated_at: null,
    };
  const { revision, ...value } = JSON.parse(row.value);
  if (!Number.isSafeInteger(revision) || revision < 1)
    throw Error("Invalid profile revision");
  return {
    profile: validateProfile(value),
    revision,
    updated_at: row.updated_at,
  };
}
export async function getProfile(db) {
  const result = serialize(await readSetting(db, KEY));
  const nav = await getNavigation(db);
  return {
    ...result,
    soop_url:
      nav.items.find((item) => item.id === "soop")?.href ||
      "https://www.sooplive.com/station/bluejin0129",
  };
}
export async function saveProfile(db, value, revision) {
  const row = await writeSetting(db, KEY, value, revision);
  return row ? serialize(row) : null;
}
