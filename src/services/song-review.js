// Song-specific three-way comparison. No API, Vue state or persistence here.
export const SONG_REVIEW_FIELDS = Object.freeze([
  ["title", "곡명"],
  ["artist", "아티스트"],
  ["genre", "장르"],
  ["language", "언어"],
  ["level", "숙련도"],
  ["practiceStatus", "연습 상태"],
  ["balloonCount", "신청 필요 풍 개수"],
  ["description", "곡 설명"],
  ["privateMemo", "관리자 메모 (비공개)"],
  ["isPublic", "공개 여부"],
]);
export function songReviewRows(base, draft, latest) {
  return SONG_REVIEW_FIELDS.filter(([key]) => draft[key] !== latest[key]).map(
    ([key, label]) => {
      const mineChanged = !base || draft[key] !== base[key];
      const serverChanged = !base || latest[key] !== base[key];
      return {
        key,
        label,
        mine: draft[key],
        latest: latest[key],
        conflict: mineChanged && serverChanged,
        selection:
          mineChanged && serverChanged ? "" : mineChanged ? "mine" : "latest",
      };
    },
  );
}
export function mergeSongReview(draft, latest, rows) {
  const result = { ...draft, sourceRevision: latest.revision };
  for (const row of rows) {
    if (!["mine", "latest"].includes(row.selection))
      throw new Error("변경된 항목마다 사용할 내용을 선택해주세요.");
    result[row.key] = row.selection === "mine" ? row.mine : row.latest;
  }
  return result;
}
export function songReviewValue(value) {
  if (typeof value === "boolean") return value ? "공개" : "비공개";
  return value === "" ? "(비어 있음)" : String(value);
}
