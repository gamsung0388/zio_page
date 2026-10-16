import { ref, watch, toValue } from "vue";
import { session } from "./api.js";
import { readDraft, writeDraft, removeDraft } from "./draft-storage.js";
export function useEditorDraft({
  scope,
  ready,
  dirty,
  snapshot,
  apply,
  validate = () => true,
  enabled = true,
}) {
  const owner = session.user?.id;
  const pending = ref(null),
    storageError = ref("");
  let initialized = "",
    previous = "",
    applying = false;
  let storage;
  try {
    storage = window.sessionStorage;
  } catch {}
  const currentScope = () => toValue(scope) || "";
  const active = () => enabled && owner && toValue(ready) && currentScope();
  function clear() {
    storageError.value = "";
    if (storage) removeDraft(storage, owner, currentScope());
    pending.value = null;
    previous = JSON.stringify(snapshot());
  }
  watch(
    [currentScope, () => toValue(ready)],
    () => {
      initialized = "";
      pending.value = null;
      const target = currentScope();
      queueMicrotask(() => {
        if (!active() || currentScope() !== target) return;
        previous = JSON.stringify(snapshot());
        initialized = target;
        const entry = storage && readDraft(storage, owner, target);
        if (entry && validate(entry.value)) pending.value = entry;
        else if (entry) removeDraft(storage, owner, target);
      });
    },
    { immediate: true, flush: "sync" },
  );
  watch(
    () => JSON.stringify(snapshot()),
    (value) => {
      if (
        applying ||
        !active() ||
        initialized !== currentScope() ||
        value === previous
      )
        return;
      previous = value;
      pending.value = null;
      if (!toValue(dirty)) {
        if (storage) removeDraft(storage, owner, currentScope());
        return;
      }
      const saved =
        storage &&
        writeDraft(storage, owner, currentScope(), JSON.parse(value));
      storageError.value = saved
        ? ""
        : "이 브라우저에서 초안을 보관할 수 없어요. 페이지를 닫기 전에 변경 내용을 저장해주세요.";
    },
    { flush: "sync" },
  );
  function restore() {
    if (!pending.value) return;
    applying = true;
    try {
      if (apply(pending.value.value) === false) return;
      pending.value = null;
      previous = JSON.stringify(snapshot());
    } finally {
      applying = false;
    }
  }
  return { pending, storageError, restore, clear };
}
