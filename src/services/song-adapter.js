import { songCover } from "./song-cover.js";
// Pure mappings only. This module does not call APIs or persist data.
import {
  SONG_TEXT_FIELDS,
  PRACTICE_OPTIONS,
  PROFICIENCY_MIN,
  PROFICIENCY_MAX,
} from "../../shared/song-rules.js";
const statusToView = Object.fromEntries(
  PRACTICE_OPTIONS.map((option) => [option.value, option.view]),
);
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
    cover: song.album?.artwork_url || songCover({ genre: song.genre }),
    ...(song.album ? { album: song.album } : {}),
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
  if (Object.hasOwn(view, "album")) input.album = view.album;
  if (admin) input.memo = (view.privateMemo || "").trim();
  return input;
}
export function validateDraft(form) {
  const errors = [];
  for (const { view: field, label, min, max } of Object.values(
    SONG_TEXT_FIELDS,
  )) {
    const required = min > 0;
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
  if (
    !Number.isInteger(Number(form.level)) ||
    form.level < PROFICIENCY_MIN ||
    form.level > PROFICIENCY_MAX
  )
    errors.push("숙련도를 1~5단계 중 선택해주세요.");
  if (!Number.isSafeInteger(Number(form.balloonCount)) || form.balloonCount < 0)
    errors.push("풍 개수는 0 이상의 안전한 정수로 입력해주세요.");
  if (!statusToApi.has(form.practiceStatus))
    errors.push("연습 상태를 확인해주세요.");
  return errors;
}
