export const administrationLinks = Object.freeze([
  {
    id: "accounts",
    label: "관리자 관리",
    href: "/admin/users",
    icon: "users",
    description: "함께 운영할 관리자를 초대하고 계정과 비밀번호를 관리해요.",
  },
  {
    id: "menus",
    label: "홈페이지 관리",
    href: "/admin/site",
    icon: "layout",
    description: "소개와 추천 곡, 메뉴·공식 링크와 테마를 정리해요.",
  },
]);
export function activeNavigation(path) {
  if (path.startsWith("/admin/songs")) return "manage";
  if (path.startsWith("/admin/schedule")) return "schedule";
  if (path.startsWith("/admin/site")) return "menus";
  if (path.startsWith("/admin/recovery")) return "administration";
  if (path.startsWith("/admin/appearance")) return "menus";
  if (path.startsWith("/admin/menus")) return "menus";
  if (path === "/admin") return "administration";
  if (path.startsWith("/admin/")) return "accounts";
  if (path.startsWith("/songs")) return "songs";
  if (path === "/about") return "about";
  return "home";
}
