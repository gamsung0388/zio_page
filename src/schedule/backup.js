import { api } from "../services/api.js";
import {
  schedulePayload,
  validateScheduleBackup,
} from "../../shared/schedule/validation.js";
export function makeScheduleBackup(weeks) {
  return validateScheduleBackup({
    version: 1,
    exported_at: new Date().toISOString(),
    weeks: weeks.map((week) => ({
      week_start: week.week_start,
      ...schedulePayload(week),
    })),
  });
}
export async function loadAllScheduleWeeks() {
  const weeks = [];
  let after = "";
  do {
    const page = await api(
      "/admin/schedules/backup" +
        (after ? "?after=" + encodeURIComponent(after) : ""),
    );
    if (
      !Array.isArray(page.items) ||
      (page.next_after && page.next_after <= after)
    )
      throw new Error("백업 응답을 확인할 수 없어요.");
    weeks.push(...page.items);
    if (weeks.length > 2000)
      throw new Error("한 번에 최대 2,000주까지 백업할 수 있어요.");
    after = page.next_after;
  } while (after);
  return weeks;
}
export function downloadScheduleBackup(weeks, filename) {
  const value = makeScheduleBackup(weeks);
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  if (blob.size > 10 * 1024 * 1024)
    throw new Error("전체 백업이 10MB를 넘어요. 현재 주 단위로 백업해주세요.");
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename + ".json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readScheduleBackup(file) {
  if (!file || file.size > 10 * 1024 * 1024)
    throw new Error("10MB 이하 JSON 백업 파일을 선택해주세요.");
  try {
    return validateScheduleBackup(JSON.parse(await file.text()));
  } catch (error) {
    throw new Error("백업 파일을 불러오지 못했어요. " + error.message);
  }
}
