import { api, downloadBlob } from "../services/api.js";
import {
  eventInput,
  validateEventBackup,
} from "../../shared/schedule/events.js";
export function fetchEventPage(
  from,
  to,
  { kind = "", page = 1, pageSize = 200, signal } = {},
) {
  return api(
    "/admin/schedule-events?" +
      new URLSearchParams({
        from,
        to,
        kind,
        page: String(page),
        page_size: String(pageSize),
      }),
    { signal },
  );
}
export async function fetchEvents(from, to, { kind = "", signal } = {}) {
  const result = [];
  let page = 1,
    total;
  do {
    const data = await fetchEventPage(from, to, { kind, page, signal });
    result.push(...data.items);
    total = data.pagination.total;
    if (total > 2000)
      throw new Error(
        "일정이 많아요. 목록 보기에서 날짜나 구분으로 나누어 확인해주세요. 전체 조회와 백업은 최대 2,000개를 지원합니다.",
      );
    if (!data.items.length && result.length < total)
      throw new Error("일정 조회 결과가 바뀌었어요. 다시 불러와주세요.");
    page++;
  } while (result.length < total);
  return result;
}
export async function fetchAllEvents() {
  const result = [];
  let after = null;
  do {
    const data = await api(
      "/admin/schedule-events/backup" + (after ? "?after=" + after : ""),
    );
    result.push(...data.items);
    if (result.length > 2000)
      throw new Error(
        "전체 백업은 최대 2,000개예요. 이번 달 백업을 이용해주세요.",
      );
    if (data.next_after !== null && data.next_after <= Number(after || 0))
      throw new Error("백업 조회 결과를 확인할 수 없어요.");
    after = data.next_after;
  } while (after);
  return result;
}
export function backupEventsFile(events, filename) {
  const data = validateEventBackup({
      format: "zio-schedule-events",
      version: 1,
      exported_at: new Date().toISOString(),
      events: events.map(eventInput),
    }),
    blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
  if (blob.size > 10 * 1024 * 1024)
    throw new Error("10MB를 넘어요. 이번 달 백업을 이용해주세요.");
  downloadBlob(blob, filename + ".json");
}
export async function readEventsFile(file) {
  if (!file || file.size > 10 * 1024 * 1024)
    throw new Error("10MB 이하 JSON 파일을 선택해주세요.");
  try {
    return validateEventBackup(JSON.parse(await file.text()));
  } catch (err) {
    throw new Error("개별 일정 백업을 확인해주세요. " + err.message);
  }
}
