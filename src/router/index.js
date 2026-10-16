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
      path: "/about",
      component: () => import("../views/AboutView.vue"),
      meta: { title: "지오 소개" },
    },
    {
      path: "/admin/songs/new",
      component: () => import("../pages/SongEditor.vue"),
      meta: { title: "새 노래 등록", admin: true },
    },
    {
      path: "/admin/songs/:id/edit",
      component: () => import("../pages/SongEditor.vue"),
      meta: { title: "노래 정보 수정", admin: true },
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
      path: "/admin/schedule",
      component: () => import("../pages/AdminSchedule.vue"),
      meta: { title: "방송 일정 달력", admin: true },
    },
    {
      path: "/admin/schedule/image",
      component: () => import("../pages/AdminScheduleImage.vue"),
      meta: { title: "주간 스케줄 이미지", admin: true },
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
      if (!(await checkSession()))
        return { path: "/admin/login", query: { next: to.fullPath } };
      if (session.user?.must_change_password && to.path !== "/admin/password")
        return { path: "/admin/password", query: { next: to.fullPath } };
    } catch {
      return {
        path: "/admin/login",
        query: { unavailable: "1", next: to.fullPath },
      };
    }
  }
});
router.afterEach((to) => {
  document.title = `${to.meta.title} · ZIO HOME`;
});
export default router;
