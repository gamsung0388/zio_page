import { PRACTICE_OPTIONS } from "../../shared/song-rules.js";
export const proficiencyLabels = [
  "",
  "연습 필요",
  "익숙하지 않음",
  "보통",
  "자신 있음",
  "완곡 가능",
];
export const practiceLabels = Object.fromEntries(
  PRACTICE_OPTIONS.map((option) => [option.value, option.label]),
);
export const sortLabels = {
  recent: "최신 등록순",
  title_asc: "제목 오름차순",
  title_desc: "제목 내림차순",
  artist_asc: "가수 오름차순",
  artist_desc: "가수 내림차순",
  proficiency_asc: "숙련도 낮은 순",
  proficiency_desc: "숙련도 높은 순",
  balloon_asc: "풍 개수 적은 순",
  balloon_desc: "풍 개수 많은 순",
};
export const formatNumber = (value) =>
  new Intl.NumberFormat("ko-KR").format(value);
