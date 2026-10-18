import { ref, reactive, computed, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "./api.js";
import { useAsyncResource } from "./useAsyncResource.js";
import {
  songListHasFilters,
  songListEmptyInfo,
} from "../../shared/song-list.js";
import { pageCount } from "../../shared/pagination.js";
export function useSongs(admin = false) {
  const route = useRoute(),
    router = useRouter();
  const items = ref([]),
    total = ref(0);
  const resource = useAsyncResource(null);
  const { error } = resource;
  const correcting = ref(false);
  const loading = computed(() => resource.loading.value || correcting.value);
  const filters = reactive({});
  const facets = reactive({ genres: [], languages: [] });
  let timer,
    facetsLoaded = false;
  const page = computed(() => Number(filters.page) || 1);
  const pageSize = computed(() => Number(filters.page_size) || 20);
  const pages = computed(() => pageCount(total.value, pageSize.value));
  const hasFilters = computed(() => songListHasFilters(filters, admin));
  const emptyInfo = computed(() => songListEmptyInfo(hasFilters.value, admin));
  async function load(refreshFacets = false) {
    const requestedPage = page.value,
      requestedSize = pageSize.value;
    const params = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined),
    );
    if (!facetsLoaded || refreshFacets) params.set("include_filters", "1");
    const data = await resource.run((signal) =>
      api(`${admin ? "/admin" : ""}/songs?${params}`, { signal }),
    );
    if (data) {
      if (data.filters) {
        Object.assign(facets, data.filters);
        facetsLoaded = true;
      }
      total.value = data.pagination.total;
      const validPage = Math.min(
        requestedPage,
        pageCount(total.value, requestedSize),
      );
      if (validPage !== requestedPage) {
        correcting.value = true;
        items.value = [];
        await router.replace({
          query: { ...route.query, page: String(validPage) },
        });
        return;
      }
      correcting.value = false;
      items.value = data.items;
    } else if (error.value) correcting.value = false;
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
  });
  return {
    items,
    total,
    hasFilters,
    emptyInfo,
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
