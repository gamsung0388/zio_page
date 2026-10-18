import { ApiError } from "../utils/http.js";
import {
  SONG_FIELDS,
  SONG_TEXT_FIELDS,
  PRACTICE_OPTIONS,
  PROFICIENCY_MIN,
  PROFICIENCY_MAX,
} from "../../shared/song-rules.js";
export { SONG_FIELDS };
export const STATUSES = PRACTICE_OPTIONS.map((option) => option.value);
const defaults = {
  description: "",
  genre: "",
  language: "",
  proficiency: 1,
  practice_status: "not_started",
  balloon_cost: 0,
  memo: "",
  is_public: true,
};
const textLimits = Object.fromEntries(
  Object.entries(SONG_TEXT_FIELDS).map(([field, rule]) => [
    field,
    [rule.min, rule.max],
  ]),
);
export function validateSong(input, partial = false) {
  const errors = [];
  const output = partial ? {} : { ...defaults };
  for (const key of Object.keys(input)) {
    if (!SONG_FIELDS.includes(key))
      errors.push({ field: key, message: "허용되지 않은 필드입니다." });
  }
  for (const field of SONG_FIELDS) {
    if (partial && !(field in input)) continue;
    const value = field in input ? input[field] : output[field];
    if (field in textLimits) {
      const [min, max] = textLimits[field];
      if (
        typeof value !== "string" ||
        Array.from(value.trim()).length < min ||
        Array.from(value.trim()).length > max
      ) {
        errors.push({
          field,
          message: `${field}: ${min}~${max}자 문자열이 필요합니다.`,
        });
      } else output[field] = value.trim();
    } else if (field === "proficiency" || field === "balloon_cost") {
      if (
        !Number.isSafeInteger(value) ||
        value < (field === "proficiency" ? PROFICIENCY_MIN : 0) ||
        (field === "proficiency" && value > PROFICIENCY_MAX)
      ) {
        errors.push({
          field,
          message:
            field === "proficiency"
              ? "숙련도는 1~5 정수여야 합니다."
              : "풍 개수는 0 이상 안전한 정수여야 합니다.",
        });
      } else output[field] = value;
    } else if (field === "practice_status") {
      if (!STATUSES.includes(value))
        errors.push({ field, message: "올바른 연습 상태를 선택해주세요." });
      else output[field] = value;
    } else if (typeof value !== "boolean")
      errors.push({ field, message: "공개 여부는 boolean이어야 합니다." });
    else output[field] = value;
  }
  if (partial && Object.keys(output).length === 0)
    errors.push({ field: "", message: "변경할 필드가 없습니다." });
  if (errors.length)
    throw new ApiError(
      422,
      "VALIDATION",
      "입력한 내용을 확인해주세요.",
      errors,
    );
  return output;
}

export const SORTS = Object.freeze({
  recent: "created_at DESC, id DESC",
  title_asc: "title COLLATE NOCASE ASC, id DESC",
  title_desc: "title COLLATE NOCASE DESC, id DESC",
  artist_asc: "artist COLLATE NOCASE ASC, id DESC",
  artist_desc: "artist COLLATE NOCASE DESC, id DESC",
  proficiency_asc: "proficiency ASC, id DESC",
  proficiency_desc: "proficiency DESC, id DESC",
  balloon_asc: "balloon_cost ASC, id DESC",
  balloon_desc: "balloon_cost DESC, id DESC",
});
export function parseFilters(params, admin = false) {
  const filters = {
    q: params.get("q")?.trim() || "",
    sort: params.get("sort") || "recent",
  };
  if (Array.from(filters.q).length > 200 || !Object.hasOwn(SORTS, filters.sort))
    throw new ApiError(
      400,
      "FILTER",
      "검색어나 정렬 조건이 올바르지 않습니다.",
    );
  for (const [field, fallback, max] of [
    ["page", 1, 100000],
    ["page_size", 20, 100],
  ]) {
    const raw = params.get(field);
    if (raw && (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max))
      throw new ApiError(400, "FILTER", "페이지 조건이 올바르지 않습니다.");
    filters[field] = raw ? Number(raw) : fallback;
  }
  for (const [field, max] of [
    ["genre", 60],
    ["language", 40],
  ]) {
    const value = params.get(field);
    if (value) {
      if (Array.from(value).length > max)
        throw new ApiError(400, "FILTER", "필터가 너무 깁니다.");
      filters[field] = value;
    }
  }
  if (params.get("proficiency")) {
    if (!/^[1-5]$/.test(params.get("proficiency")))
      throw new ApiError(400, "FILTER", "숙련도는 1~5입니다.");
    filters.proficiency = Number(params.get("proficiency"));
  }
  if (params.get("practice_status")) {
    if (!STATUSES.includes(params.get("practice_status")))
      throw new ApiError(400, "FILTER", "연습 상태가 올바르지 않습니다.");
    filters.practice_status = params.get("practice_status");
  }
  if (admin && params.get("is_public")) {
    if (!["true", "false"].includes(params.get("is_public")))
      throw new ApiError(400, "FILTER", "공개 필터가 올바르지 않습니다.");
    filters.is_public = params.get("is_public") === "true" ? 1 : 0;
  }
  filters.include_filters = params.get("include_filters") === "1";
  return filters;
}
