import { ref, shallowRef, onBeforeUnmount } from "vue";

// One owner for cancellation and stale-response protection, shared by list screens.
export function useAsyncResource(initialValue) {
  const data = shallowRef(initialValue),
    loading = ref(false),
    error = ref("");
  let controller,
    disposed = false;
  async function run(loader) {
    controller?.abort();
    const request = new AbortController();
    controller = request;
    loading.value = true;
    error.value = "";
    try {
      const value = await loader(request.signal);
      if (disposed || request !== controller || request.signal.aborted) return;
      data.value = value;
      return value;
    } catch (err) {
      if (!disposed && request === controller && err.name !== "AbortError")
        error.value = err.message;
    } finally {
      if (!disposed && request === controller) loading.value = false;
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    controller?.abort();
  });
  return { data, loading, error, run };
}
