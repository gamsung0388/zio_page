<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { session, api, checkSession } from "./services/api.js";
import Icon from "./components/Icon.vue";
const route = useRoute(),
  router = useRouter();
async function logout() {
  try {
    await api("/admin/logout", { method: "POST" });
    session.user = null;
    session.csrfToken = "";
    router.push("/admin/login");
  } catch (error) {
    if (error.status === 401) router.push("/admin/login");
    else alert(error.message);
  }
}
function expired(event) {
  if (route.meta.admin && event.detail !== "/admin/me")
    router.replace("/admin/login?expired=1");
}
function passwordRequired() {
  router.replace("/admin/password");
}
onMounted(() => {
  window.addEventListener("zio-session-expired", expired);
  window.addEventListener("zio-password-change-required", passwordRequired);
  router.isReady().then(async () => {
    if (!session.checked) await checkSession();
  }).catch(() => {
    // Public pages remain usable when the session check is unavailable.
  });
});
onBeforeUnmount(
  () => (
    window.removeEventListener("zio-session-expired", expired),
    window.removeEventListener("zio-password-change-required", passwordRequired)
  ),
);
</script>
<template>
  <a class="skip-link" href="#main">본문 바로가기</a>
  <header class="site-header" :class="{ 'is-admin': session.user }">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" aria-label="ZIO HOME 홈"
        ><img src="/favicon.svg" alt="" width="37" height="37" /><span
          >ZIO<span class="brand-home">HOME</span
          ><small>지오의 작은 음악 공간</small></span
        ></RouterLink
      >
      <nav class="main-nav" aria-label="주 메뉴">
        <RouterLink to="/" :class="{ active: route.path === '/' }"
          >홈</RouterLink
        ><RouterLink
          to="/songs"
          :class="{ active: route.path.startsWith('/songs') }"
          >노래책자</RouterLink
        ><RouterLink
          v-if="session.user"
          to="/admin/songs"
          :class="{ active: route.path === '/admin/songs' }"
          >노래 관리</RouterLink
        ><RouterLink
          v-if="session.user"
          to="/admin"
          :class="{ active: route.meta.admin && route.path !== '/admin/songs' }"
          >관리자 관리</RouterLink
        >
      </nav>
      <div class="admin-nav">
        <button v-if="session.user" class="text-button" @click="logout">
          <Icon name="logout" :size="15" /><span>로그아웃</span></button
        ><RouterLink v-else to="/admin/login"
          ><Icon name="lock" :size="14" /><span>관리자</span></RouterLink
        >
      </div>
    </div>
  </header>
  <main id="main" tabindex="-1"><RouterView :key="route.path" /></main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <div>
        <RouterLink to="/" class="footer-brand"
          >ZIO HOME <span>작은 노래가 모이는 곳.</span></RouterLink
        >
        <p>오늘도 지오의 음악 공간에 함께해주셔서 고마워요.</p>
      </div>
      <div class="footer-right">
        <RouterLink v-if="session.user" to="/admin/songs">노래 관리</RouterLink>
        <RouterLink :to="session.user ? '/admin' : '/admin/login'">{{
          session.user ? "관리자 관리" : "관리자 로그인"
        }}</RouterLink
        ><span>© {{ new Date().getFullYear() }} ZIO HOME</span>
      </div>
    </div>
  </footer>
</template>
