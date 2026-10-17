export const MENU_AREAS = Object.freeze([
  {
    value: "public",
    label: "지오의 공간",
    description: "방문자와 관리자 모두에게 보여요.",
  },
  {
    value: "work",
    label: "운영",
    description: "로그인한 관리자에게만 보여요.",
  },
  { value: "footer", label: "바로가기", description: "메뉴 아래쪽에 보여요." },
]);
export const BUILTIN_MENUS = Object.freeze([
  {
    id: "home",
    label: "홈",
    area: "public",
    href: "/",
    icon: "home",
    targetLabel: "홈페이지",
    visible: true,
  },
  {
    id: "songs",
    label: "노래책자",
    area: "public",
    href: "/songs",
    icon: "book",
    targetLabel: "노래책자 페이지",
    visible: true,
  },
  {
    id: "about",
    label: "지오 소개",
    area: "public",
    href: "/about",
    icon: "leaf",
    targetLabel: "지오 소개 페이지",
    visible: true,
  },
  {
    id: "manage",
    label: "노래 관리",
    area: "work",
    href: "/admin/songs",
    icon: "music",
    targetLabel: "노래 관리 화면",
    visible: true,
  },
  {
    id: "schedule",
    label: "일정 관리",
    area: "work",
    href: "/admin/schedule",
    icon: "calendar",
    targetLabel: "일정 관리 화면",
    visible: true,
  },
  {
    id: "soop",
    label: "SOOP 방송국",
    area: "footer",
    href: "https://www.sooplive.com/station/bluejin0129",
    icon: "external",
    visible: true,
  },
]);
const fields = ["id", "label", "area", "href", "visible"];
export function defaultNavigation() {
  return BUILTIN_MENUS.map((item) =>
    Object.fromEntries(fields.map((key) => [key, item[key]])),
  );
}
export function builtinMenu(id) {
  return BUILTIN_MENUS.find((item) => item.id === id);
}
export function validateMenuLink(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\u0000-\u001f\u007f]/.test(value)
  )
    throw new Error("링크 주소를 공백 없이 2,048자 이내로 입력해주세요.");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("https://로 시작하는 전체 링크 주소를 입력해주세요.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("로그인 정보가 없는 https:// 링크를 사용해주세요.");
  return url.href;
}
export function validateNavigation(items) {
  if (
    !Array.isArray(items) ||
    items.length < BUILTIN_MENUS.length ||
    items.length > 26
  )
    throw new Error(
      "기본 메뉴를 유지하고 새 링크는 최대 20개까지 추가할 수 있어요.",
    );
  const ids = new Set();
  const result = items.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => !fields.includes(key)) ||
      fields.some((key) => !Object.hasOwn(item, key))
    )
      throw new Error("메뉴의 입력 항목을 확인해주세요.");
    if (typeof item.id !== "string" || ids.has(item.id))
      throw new Error("메뉴가 중복되었어요.");
    ids.add(item.id);
    const builtin = builtinMenu(item.id);
    if (!builtin && !/^link-[a-z0-9-]{1,50}$/.test(item.id))
      throw new Error("메뉴 식별자를 확인해주세요.");
    if (
      typeof item.label !== "string" ||
      !item.label.trim() ||
      Array.from(item.label.trim()).length > 24 ||
      /[\u0000-\u001f\u007f]/.test(item.label)
    )
      throw new Error("메뉴 이름은 1~24자로 입력해주세요.");
    if (
      !MENU_AREAS.some((area) => area.value === item.area) ||
      (builtin && item.area !== builtin.area) ||
      typeof item.visible !== "boolean"
    )
      throw new Error("메뉴 표시 위치와 표시 여부를 확인해주세요.");
    if (item.id === "home" && !item.visible)
      throw new Error("홈 메뉴는 항상 표시합니다.");
    const href =
      builtin && builtin.id !== "soop"
        ? builtin.href
        : validateMenuLink(item.href);
    if (builtin && builtin.id !== "soop" && item.href !== builtin.href)
      throw new Error("기본 페이지의 연결 대상은 바꿀 수 없어요.");
    return {
      id: item.id,
      label: item.label.trim(),
      area: item.area,
      href,
      visible: item.visible,
    };
  });
  if (BUILTIN_MENUS.some((item) => !ids.has(item.id)))
    throw new Error("기본 메뉴는 삭제 대신 숨기기를 사용해주세요.");
  return result;
}
export function publicNavigation(items) {
  return items.filter((item) => item.visible && item.area !== "work");
}
export function menuPresentation(item) {
  const builtin = builtinMenu(item.id);
  return {
    ...item,
    icon: builtin?.icon || "external",
    external: !item.href.startsWith("/"),
    targetLabel: builtin?.targetLabel || item.href,
  };
}
export function moveMenu(items, id, direction) {
  if (![-1, 1].includes(direction)) return items.slice();
  const result = items.slice(),
    index = result.findIndex((item) => item.id === id);
  if (index < 0) return result;
  let other = index + direction;
  while (
    other >= 0 &&
    other < result.length &&
    result[other].area !== result[index].area
  )
    other += direction;
  if (other >= 0 && other < result.length)
    [result[index], result[other]] = [result[other], result[index]];
  return result;
}
export function isNavigationDraft(value) {
  if (
    !value ||
    Object.keys(value).some((key) => !["items", "revision"].includes(key)) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    return false;
  try {
    validateNavigation(value.items);
    return true;
  } catch {
    return false;
  }
}
