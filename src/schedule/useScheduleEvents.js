import { computed, watch } from "vue";
import { useAsyncResource } from "../services/useAsyncResource.js";
import { pageCount } from "../../shared/pagination.js";
import { eventQuery, EVENT_LIST_PAGE_SIZE } from "./event-query.js";
import { fetchEvents, fetchEventPage } from "./events-service.js";

export function useScheduleEvents({
  month,
  view,
  day,
  kind,
  page,
  correctPage,
}) {
  const request = useAsyncResource({ items: [], pagination: { total: 0 } });
  const query = computed(() =>
    eventQuery({
      month: month.value,
      view: view.value,
      day: day.value,
      kind: kind.value,
      page: page.value,
    }),
  );
  const key = computed(() => JSON.stringify(query.value));
  const events = computed(() => request.data.value.items);
  const total = computed(() => request.data.value.pagination.total);
  const pages = computed(() => pageCount(total.value, EVENT_LIST_PAGE_SIZE));
  async function load() {
    const value = { ...query.value };
    const result = await request.run(async (signal) =>
      value.view === "list"
        ? fetchEventPage(value.from, value.to, {
            kind: value.kind,
            page: value.page,
            pageSize: EVENT_LIST_PAGE_SIZE,
            signal,
          })
        : {
            items: await fetchEvents(value.from, value.to, {
              kind: value.kind,
              signal,
            }),
            pagination: { total: 0 },
          },
    );
    if (result && value.view === "list" && value.page > pages.value)
      await correctPage(pages.value);
  }
  watch(key, load, { immediate: true });
  return {
    events,
    total,
    pages,
    key,
    load,
    loading: request.loading,
    error: request.error,
  };
}
