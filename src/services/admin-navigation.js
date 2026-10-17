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
    label: "메뉴 관리",
    href: "/admin/menus",
    icon: "layout",
    description: "메뉴 이름과 순서를 다듬고 필요한 링크를 더해요.",
  },
]);
export function activeNavigation(path) {
  if (path.startsWith("/admin/songs")) return "manage";
  if (path.startsWith("/admin/schedule")) return "schedule";
  if (path.startsWith("/admin/menus")) return "menus";
  if (path === "/admin") return "administration";
  if (path.startsWith("/admin/")) return "accounts";
  if (path.startsWith("/songs")) return "songs";
  if (path === "/about") return "about";
  return "home";
}
