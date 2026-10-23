import { siteProfile } from "./site-profile.js";
import { shallowRef, watch } from "vue";
import { api, session } from "./api.js";
import { useAsyncResource } from "./useAsyncResource.js";
import { defaultNavigation } from "../../shared/navigation.js";
export const siteMenus = shallowRef(defaultNavigation());
let owner = "",
  savedRevision = 0;
export function applySiteNavigation(data, userId) {
  if (String(userId || "public") !== owner) return;
  if (data.revision !== undefined && data.revision < savedRevision) return;
  siteMenus.value = data.items;
  const soop = data.items.find((item) => item.id === "soop");
  if (soop) siteProfile.value = { ...siteProfile.value, soop_url: soop.href };
  savedRevision = data.revision || 0;
}
export function useSiteNavigation() {
  const request = useAsyncResource(null);
  watch(
    [
      () => session.checked,
      () => session.user?.id,
      () => session.user?.must_change_password,
    ],
    async ([ready, id, forced]) => {
      if (!ready) return;
      const privateAccess = id && !forced,
        key = String(privateAccess ? id : "public");
      owner = key;
      savedRevision = 0;
      siteMenus.value = defaultNavigation();
      const data = await request.run((signal) =>
        api(privateAccess ? "/admin/navigation" : "/navigation", { signal }),
      );
      if (data) applySiteNavigation(data, privateAccess ? id : null);
    },
    { immediate: true },
  );
  return siteMenus;
}
