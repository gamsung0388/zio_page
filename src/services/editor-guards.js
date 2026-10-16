import { onBeforeUnmount } from "vue";
const guards = new Set();
export function useEditorGuard(isDirty) {
  guards.add(isDirty);
  onBeforeUnmount(() => guards.delete(isDirty));
}
export function confirmLogout() {
  return (
    ![...guards].some((guard) => guard()) ||
    window.confirm("저장하지 않은 변경이 있어요. 초안을 버리고 로그아웃할까요?")
  );
}
