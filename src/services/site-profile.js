import { ref } from "vue";
import { api } from "./api.js";
import { DEFAULT_PROFILE } from "../../shared/site-profile.js";
export const siteProfile = ref({
  ...structuredClone(DEFAULT_PROFILE),
  soop_url: "https://www.sooplive.com/station/bluejin0129",
  featured: [],
});
let pending;
export async function loadSiteProfile() {
  if (!pending)
    pending = api("/site")
      .then((data) => (siteProfile.value = data))
      .finally(() => (pending = null));
  return pending;
}
