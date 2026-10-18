export const DEFAULT_THEME = "forest";
export const THEME_OPTIONS = Object.freeze([
  {
    id: "forest",
    name: "숲속 음악방",
    description: "짙은 초록과 부드러운 아이보리, 지오의 작은 숲",
    colors: ["#113726", "#8fc36a", "#f7f8f4"],
  },
  {
    id: "garden",
    name: "햇살 정원",
    description: "따뜻한 크림과 올리브, 햇살이 머무는 오후",
    colors: ["#454c28", "#c3ce91", "#fbf7ee"],
  },
  {
    id: "starlight",
    name: "별빛 음악방",
    description: "차분한 밤빛과 라벤더, 노래가 흐르는 저녁",
    colors: ["#273852", "#aebce1", "#f2f4fa"],
  },
]);
export function isTheme(value) {
  return THEME_OPTIONS.some((theme) => theme.id === value);
}
export function validateAppearance(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !isTheme(value.theme)
  )
    throw new Error("준비된 테마 중 하나를 선택해주세요.");
  return { theme: value.theme };
}
export function resolveTheme(preference, siteTheme, preview) {
  return isTheme(preview)
    ? preview
    : isTheme(preference)
      ? preference
      : isTheme(siteTheme)
        ? siteTheme
        : DEFAULT_THEME;
}
