import { ref, computed, onMounted, nextTick } from "vue";
import { api, session } from "./api.js";
import { useAsyncResource } from "./useAsyncResource.js";
import { useEditorDraft } from "./useEditorDraft.js";
import { applySiteNavigation } from "./useSiteNavigation.js";
import { notify } from "./notifications.js";
import {
  defaultNavigation,
  validateNavigation,
  isNavigationDraft,
} from "../../shared/navigation.js";

export function useNavigationEditor() {
  const items = ref(defaultNavigation()),
    revision = ref(0),
    baseline = ref(""),
    ready = ref(false);
  const busy = ref(false),
    error = ref(""),
    conflict = ref(false);
  const request = useAsyncResource(null);
  const dirty = computed(
    () =>
      Boolean(baseline.value) && JSON.stringify(items.value) !== baseline.value,
  );
  const drafts = useEditorDraft({
    scope: "site-navigation",
    ready,
    dirty,
    snapshot: () => ({
      items: items.value.map((item) => ({ ...item })),
      revision: revision.value,
    }),
    validate: isNavigationDraft,
    apply(value) {
      items.value = value.items;
      revision.value = value.revision;
    },
  });
  async function load() {
    if (busy.value) return;
    if (
      dirty.value &&
      !window.confirm("내 편집을 버리고 저장된 메뉴를 불러올까요?")
    )
      return;
    if (dirty.value) drafts.clear();
    ready.value = false;
    const result = await request.run((signal) =>
      api("/admin/navigation", { signal }),
    );
    if (result) {
      items.value = result.items;
      revision.value = result.revision;
      baseline.value = JSON.stringify(result.items);
      conflict.value = false;
      error.value = "";
      ready.value = true;
    }
  }
  async function save() {
    if (busy.value || !dirty.value || conflict.value) return;
    error.value = "";
    let payload;
    try {
      payload = validateNavigation(items.value);
    } catch (err) {
      error.value = err.message;
      return;
    }
    drafts.persist();
    busy.value = true;
    try {
      const result = await api("/admin/navigation", {
        method: "PUT",
        body: { items: payload, expected_revision: revision.value },
      });
      items.value = result.items;
      revision.value = result.revision;
      baseline.value = JSON.stringify(result.items);
      drafts.clear();
      applySiteNavigation(result, session.user?.id);
      notify("메뉴를 저장했어요. 홈페이지 메뉴에도 반영했습니다.");
    } catch (err) {
      error.value = err.message;
      conflict.value = err.code === "NAVIGATION_CONFLICT";
      await nextTick();
      document.getElementById("menu-save-error")?.focus();
    } finally {
      busy.value = false;
    }
  }
  function reset() {
    if (
      busy.value ||
      !window.confirm(
        "편집 내용을 기본 메뉴로 바꿀까요? 저장하기 전에는 홈페이지에 반영되지 않아요.",
      )
    )
      return;
    items.value = defaultNavigation();
  }
  function confirmLeave(extraDirty = false) {
    if (busy.value) return false;
    if (
      (dirty.value || extraDirty) &&
      !window.confirm("저장하지 않은 메뉴 변경을 버리고 이동할까요?")
    )
      return false;
    drafts.clear();
    return true;
  }
  onMounted(load);
  return {
    items,
    revision,
    dirty,
    busy,
    error,
    conflict,
    ready,
    load,
    save,
    reset,
    confirmLeave,
    drafts,
    loading: request.loading,
    loadError: request.error,
  };
}
