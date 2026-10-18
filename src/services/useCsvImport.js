import { ref, shallowRef, onBeforeUnmount } from "vue";
import { api, session } from "./api.js";
import { fileHash, importTask, completeImportTask } from "./csv-import-task.js";

export function useCsvImport(imported) {
  const file = shallowRef(null),
    preview = shallowRef(null),
    error = ref(""),
    busy = ref(false),
    acknowledged = ref(false),
    storageNotice = ref("");
  let task,
    owner,
    selection = 0,
    disposed = false;
  const storage = () => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  };
  onBeforeUnmount(() => {
    disposed = true;
    selection++;
  });
  async function selectFile(event) {
    if (busy.value) return;
    const current = ++selection,
      selected = event.target.files?.[0];
    preview.value = null;
    acknowledged.value = false;
    error.value = "";
    task = null;
    file.value = null;
    storageNotice.value = "";
    if (!selected) return;
    if (selected.size > 1024 * 1024) {
      error.value = "CSV 파일은 1MB 이하로 선택해주세요.";
      return;
    }
    busy.value = true;
    try {
      const hash = await fileHash(selected);
      if (disposed || selection !== current) return;
      owner = session.user?.id;
      task = importTask(storage(), owner, hash);
      file.value = selected;
      if (!task.persisted)
        storageNotice.value =
          "이 브라우저에서는 재시도 정보를 보관할 수 없어요. 등록 결과를 확인할 때까지 이 창을 유지해주세요.";
    } catch {
      error.value = "파일을 확인하지 못했어요. 파일을 다시 선택해주세요.";
    } finally {
      if (!disposed && selection === current) busy.value = false;
    }
  }
  async function send(importing = false) {
    if (busy.value || !file.value || !task || (importing && !preview.value))
      return;
    busy.value = true;
    error.value = "";
    try {
      const result = await api(
        `/admin/songs/import${importing ? "" : "/preview"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Idempotency-Key": task.key,
            ...(importing
              ? {
                  "X-CSV-Preview": preview.value.preview_token,
                  "X-CSV-Duplicates": acknowledged.value ? "yes" : "no",
                }
              : {}),
          },
          body: file.value,
        },
      );
      if (disposed) return;
      const completed = result.completed || (importing ? result : null);
      if (completed) {
        completeImportTask(storage(), owner, task);
        imported(
          completed.replayed
            ? `${completed.imported}곡은 이미 추가되어 있어요. 중복으로 등록하지 않았습니다.`
            : `${completed.imported}곡을 추가했습니다.`,
        );
      } else {
        preview.value = result;
        acknowledged.value = false;
      }
    } catch (err) {
      if (disposed) return;
      if (
        ["CSV_PREVIEW_CHANGED", "CSV_DUPLICATES_REQUIRED"].includes(err.code) &&
        err.details?.preview
      ) {
        preview.value = err.details.preview;
        acknowledged.value = false;
      }
      error.value = err.message;
    } finally {
      if (!disposed) busy.value = false;
    }
  }
  return {
    file,
    preview,
    error,
    busy,
    acknowledged,
    storageNotice,
    selectFile,
    send,
  };
}
