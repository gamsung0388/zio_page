// Pure mappings only. This module does not call APIs or persist data.
const statusToView = {
  not_started: "미연습",
  practicing: "연습중",
  completed: "완료",
  on_hold: "잠시 보류",
};
const statusToApi = new Map(
  Object.entries(statusToView).map(([key, value]) => [value, key]),
);
export function toSongView(song, { admin = false } = {}) {
  const view = {
    id: String(song.id),
    title: song.title,
    artist: song.artist,
    genre: song.genre || "",
    language: song.language || "",
    level: song.proficiency,
    practiceStatus: statusToView[song.practice_status] || "미연습",
    balloonCount: song.balloon_cost,
    description: song.description || "",
    isPublic: Boolean(song.is_public),
    createdAt: song.created_at,
    updatedAt: song.updated_at,
    cover: "",
    links: [],
  };
  if (admin) {
    view.privateMemo = song.memo || "";
    view.revision = song.revision;
  }
  return view;
}
export function toSongInput(view, { admin = false } = {}) {
  const input = {
    title: view.title.trim(),
    artist: view.artist.trim(),
    genre: view.genre.trim(),
    language: (view.language || "").trim(),
    description: view.description.trim(),
    proficiency: Number(view.level),
    practice_status: statusToApi.get(view.practiceStatus),
    balloon_cost: Number(view.balloonCount),
    is_public: view.isPublic !== false,
  };
  if (admin) input.memo = (view.privateMemo || "").trim();
  return input;
}
export function validateDraft(form) {
  const errors = [];
  for (const [field, label, max, required] of [
    ["title", "곡명", 200, true],
    ["artist", "아티스트", 200, true],
    ["genre", "장르", 60, false],
    ["language", "언어", 40, false],
    ["description", "곡 설명", 5000, false],
    ["privateMemo", "비공개 메모", 3000, false],
  ]) {
    const length = Array.from(String(form[field] || "").trim()).length;
    if ((required && !length) || length > max)
      errors.push(
        label +
          "은 " +
          (required ? "1" : "0") +
          "~" +
          max +
          "자로 입력해주세요.",
      );
  }
  if (!Number.isInteger(Number(form.level)) || form.level < 1 || form.level > 5)
    errors.push("숙련도를 1~5단계 중 선택해주세요.");
  if (!Number.isSafeInteger(Number(form.balloonCount)) || form.balloonCount < 0)
    errors.push("풍 개수는 0 이상의 안전한 정수로 입력해주세요.");
  if (!statusToApi.has(form.practiceStatus))
    errors.push("연습 상태를 확인해주세요.");
  return errors;
}
