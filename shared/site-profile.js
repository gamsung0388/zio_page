export const DEFAULT_PROFILE = Object.freeze({
  intro_title: "지오의 작은 음악 공간",
  intro_text:
    "좋은 노래로, 오늘도 함께해요. 지오의 노래와 방송 이야기를 만나보세요.",
  about_text:
    "검은 긴 머리와 초록빛 눈을 가진 버추얼 스트리머 지오의 작은 음악 공간입니다. 노래책자에서 좋아하는 곡을 찾아보고 방송국에서 만나요.",
  social_links: [],
  featured_ids: [],
});
export function validateProfile(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !Object.hasOwn(DEFAULT_PROFILE, k))
  )
    throw Error("홈페이지 설정 항목을 확인해주세요.");
  const value = {};
  for (const [k, max] of [
    ["intro_title", 60],
    ["intro_text", 300],
    ["about_text", 1500],
  ]) {
    if (
      typeof input[k] !== "string" ||
      !input[k].trim() ||
      Array.from(input[k]).length > max
    )
      throw Error("소개 문구의 글자 수와 필수 항목을 확인해주세요.");
    value[k] = input[k].trim();
  }
  if (!Array.isArray(input.social_links) || input.social_links.length > 5)
    throw Error("공식 링크는 5개까지 등록할 수 있어요.");
  value.social_links = input.social_links.map((link) => {
    if (
      !link ||
      Object.keys(link).some((k) => !["label", "href"].includes(k)) ||
      typeof link.label !== "string" ||
      !link.label.trim() ||
      link.label.length > 24 ||
      typeof link.href !== "string" ||
      link.href.length > 2048 ||
      /[\s\u0000-\u001f]/.test(link.href)
    )
      throw Error("링크 이름과 HTTPS 주소를 확인해주세요.");
    const url = new URL(link.href);
    if (url.protocol !== "https:" || url.username || url.password)
      throw Error("공식 링크는 HTTPS 주소를 사용해주세요.");
    return { label: link.label.trim(), href: url.href };
  });
  if (
    !Array.isArray(input.featured_ids) ||
    input.featured_ids.length > 4 ||
    input.featured_ids.some((id) => !Number.isSafeInteger(id) || id < 1) ||
    new Set(input.featured_ids).size !== input.featured_ids.length
  )
    throw Error("추천 곡을 중복 없이 4곡까지 선택해주세요.");
  value.featured_ids = [...input.featured_ids];
  return value;
}
