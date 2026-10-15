import { createRouter, createWebHistory } from "vue-router";
import { checkSession, session } from "../services/api.js";
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("../pages/Home.vue"),
      meta: { title: "지오의 작은 음악 공간" },
    },
    {
      path: "/songs",
      component: () => import("../pages/Songs.vue"),
      meta: { title: "노래책자" },
    },
    {
      path: "/songs/:id",
      component: () => import("../pages/SongDetail.vue"),
      meta: { title: "노래 상세" },
    },
    {
      path: "/admin/login",
      component: () => import("../pages/AdminLogin.vue"),
      meta: { title: "관리자 로그인" },
    },
    {
      path: "/admin",
      component: () => import("../pages/AdminHome.vue"),
      meta: { title: "관리자 관리 메뉴", admin: true },
    },
    {
      path: "/admin/password-reset",
      component: () => import("../pages/AdminUsers.vue"),
      props: { resetMode: true },
      meta: { title: "관리자 비밀번호 초기화", admin: true },
    },
    {
      path: "/admin/users",
      component: () => import("../pages/AdminUsers.vue"),
      meta: { title: "관리자 관리", admin: true },
    },
    {
      path: "/admin/password",
      component: () => import("../pages/AdminPassword.vue"),
      meta: { title: "관리자 비밀번호 변경", admin: true },
    },
    {
      path: "/admin/songs",
      component: () => import("../pages/AdminSongs.vue"),
      meta: { title: "노래 관리", admin: true },
    },
    {
      path: "/:pathMatch(.*)*",
      component: () => import("../pages/NotFound.vue"),
      meta: { title: "페이지를 찾을 수 없어요" },
    },
  ],
  scrollBehavior(to, from, saved) {
    return saved || (to.path === from.path ? false : { top: 0 });
  },
});
router.beforeEach(async (to) => {
  if (to.meta.admin) {
    try {
      if (!(await checkSession())) return { path: "/admin/login" };
      if (session.user?.must_change_password && to.path !== "/admin/password")
        return { path: "/admin/password" };
    } catch {
      return { path: "/admin/login", query: { unavailable: "1" } };
    }
  }
});
router.afterEach((to) => {
  document.title = `${to.meta.title} · ZIO HOME`;
});
export default router;
