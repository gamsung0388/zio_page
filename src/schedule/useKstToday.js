import { ref, onMounted, onBeforeUnmount } from "vue";
import { todayKst } from "../../shared/schedule/dates.js";
export function useKstToday() {
  const today = ref(todayKst());
  let timer;
  function refresh() {
    today.value = todayKst();
    clearTimeout(timer);
    const day = 86400000,
      offset = 9 * 3600000;
    timer = setTimeout(refresh, day - ((Date.now() + offset) % day) + 100);
  }
  onMounted(() => {
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
  });
  onBeforeUnmount(() => {
    clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  });
  return today;
}
