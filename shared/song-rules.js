// Pure song rules shared by forms, CSV and server validation.
export const PROFICIENCY_MIN = 1;
export const PROFICIENCY_MAX = 5;
export const SONG_FIELDS = Object.freeze([
  "title",
  "artist",
  "description",
  "genre",
  "language",
  "proficiency",
  "practice_status",
  "balloon_cost",
  "memo",
  "is_public",
]);
export const SONG_TEXT_FIELDS = Object.freeze({
  title: { view: "title", label: "곡명", min: 1, max: 200 },
  artist: { view: "artist", label: "아티스트", min: 1, max: 200 },
  description: { view: "description", label: "곡 설명", min: 0, max: 5000 },
  genre: { view: "genre", label: "장르", min: 0, max: 60 },
  language: { view: "language", label: "언어", min: 0, max: 40 },
  memo: { view: "privateMemo", label: "비공개 메모", min: 0, max: 3000 },
});
export const PRACTICE_OPTIONS = Object.freeze([
  { value: "not_started", label: "미연습", view: "미연습" },
  { value: "practicing", label: "연습 중", view: "연습중" },
  { value: "completed", label: "연습 완료", view: "완료" },
  { value: "on_hold", label: "잠시 보류", view: "잠시 보류" },
]);
