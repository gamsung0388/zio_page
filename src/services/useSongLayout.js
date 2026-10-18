import { ref, computed, onBeforeUnmount } from "vue";
export function useSongLayout() {
  const media = window.matchMedia("(min-width: 1200px)"),
    desktop = ref(media.matches);
  let initial = "list";
  try {
    if (localStorage.getItem("zio:song-layout") === "cards") initial = "cards";
  } catch {}
  const preferred = ref(initial);
  const change = (event) => {
    desktop.value = event.matches;
  };
  media.addEventListener("change", change);
  onBeforeUnmount(() => media.removeEventListener("change", change));
  function select(value) {
    if (!["list", "cards"].includes(value)) return;
    preferred.value = value;
    try {
      localStorage.setItem("zio:song-layout", value);
    } catch {}
  }
  return {
    desktop,
    layout: computed(() => (desktop.value ? preferred.value : "cards")),
    select,
  };
}
