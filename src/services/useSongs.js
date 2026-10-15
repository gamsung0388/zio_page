import { ref, reactive, computed, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "./api.js";
export function useSongs(admin = false) {
  const route = useRoute(),
    router = useRouter();
  const items = ref([]),
    total = ref(0),
    loading = ref(true),
    error = ref("");
  const filters = reactive({});
  const facets = reactive({ genres: [], languages: [] });
  let timer,
    controller,
    facetsLoaded = false;
  const page = computed(() => Number(filters.page) || 1);
  const pageSize = computed(() => Number(filters.page_size) || 20);
  const pages = computed(() =>
    Math.max(1, Math.ceil(total.value / pageSize.value)),
  );
  async function load(refreshFacets = false) {
    controller?.abort();
    controller = new AbortController();
    const thisController = controller;
    loading.value = true;
    error.value = "";
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined),
    );
    if (!facetsLoaded || refreshFacets) params.set("include_filters", "1");
    try {
      const data = await api(`${admin ? "/admin" : ""}/songs?${params}`, {
        signal: thisController.signal,
      });
      items.value = data.items;
      total.value = data.pagination.total;
      if (data.filters) {
        Object.assign(facets, data.filters);
        facetsLoaded = true;
      }
    } catch (err) {
      if (err.name !== "AbortError") error.value = err.message;
    } finally {
      if (controller === thisController) loading.value = false;
    }
  }
  watch(
    () => route.query,
    (query) => {
      Object.keys(filters).forEach((key) => delete filters[key]);
      Object.assign(filters, {
        q: "",
        sort: "recent",
        page: "1",
        page_size: "20",
        ...Object.fromEntries(
          Object.entries(query).filter(
            ([key, value]) =>
              [
                "q",
                "sort",
                "page",
                "page_size",
                "proficiency",
                "practice_status",
                "genre",
                "language",
                "is_public",
              ].includes(key) && typeof value === "string",
          ),
        ),
      });
      load();
    },
    { immediate: true },
  );
  function update(key, value) {
    clearTimeout(timer);
    router.replace({
      query: {
        ...route.query,
        q: filters.q || undefined,
        [key]: value || undefined,
        page: key === "page" ? String(value) : "1",
      },
    });
  }
  function search(value) {
    filters.q = value;
    clearTimeout(timer);
    timer = setTimeout(() => update("q", value), 320);
  }
  function reset() {
    clearTimeout(timer);
    filters.q = "";
    router.replace({ query: {} });
  }
  onBeforeUnmount(() => {
    clearTimeout(timer);
    controller?.abort();
  });
  return {
    items,
    total,
    loading,
    error,
    filters,
    facets,
    page,
    pageSize,
    pages,
    load,
    update,
    search,
    reset,
  };
}
