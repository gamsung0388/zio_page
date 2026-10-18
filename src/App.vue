<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { session, api, checkSession } from "./services/api.js";
import { confirmLogout } from "./services/editor-guards.js";
import { clearUserDrafts } from "./services/draft-storage.js";
import { notification } from "./services/notifications.js";
import { activeNavigation } from "./services/admin-navigation.js";
import { useSiteNavigation } from "./services/useSiteNavigation.js";
import AppSidebar from "./components/AppSidebar.vue";
import SceneBanner from "./components/SceneBanner.vue";
import AppHeader from "./components/AppHeader.vue";
const route = useRoute(),
  router = useRouter(),
  mobileOpen = ref(false),
  busy = ref(false),
  logoutError = ref("");
const current = computed(() => activeNavigation(route.path));
const menus = useSiteNavigation();
watch(
  () => route.path,
  () => {
    mobileOpen.value = false;
    logoutError.value = "";
  },
);
async function logout() {
  if (busy.value || !confirmLogout()) return;
  busy.value = true;
  logoutError.value = "";
  const owner = session.user?.id;
  try {
    await api("/admin/logout", { method: "POST" });
    try {
      clearUserDrafts(window.sessionStorage, owner);
    } catch {}
    session.user = null;
    session.csrfToken = "";
    notification.value = "";
    await router.push("/admin/login");
  } catch (error) {
    if (error.status === 401) {
      try {
        clearUserDrafts(window.sessionStorage, owner);
      } catch {}
      await router.push("/admin/login");
    } else logoutError.value = error.message;
  } finally {
    busy.value = false;
  }
}
function expired(event) {
  if (route.meta.admin && event.detail !== "/admin/me")
    router.replace({
      path: "/admin/login",
      query: { expired: "1", next: route.fullPath },
    });
}
function passwordRequired() {
  router.replace({ path: "/admin/password", query: { next: route.fullPath } });
}
onMounted(() => {
  window.addEventListener("zio-session-expired", expired);
  window.addEventListener("zio-password-change-required", passwordRequired);
  router
    .isReady()
    .then(async () => {
      if (!session.checked) await checkSession();
    })
    .catch(() => {});
});
onBeforeUnmount(() => {
  window.removeEventListener("zio-session-expired", expired);
  window.removeEventListener("zio-password-change-required", passwordRequired);
});
</script>
<template>
  <a class="skip-link" href="#main">본문 바로가기</a>
  <div
    class="app-shell integrated-app"
    :class="{
      'management-shell': ['administration', 'accounts', 'menus'].includes(
        current,
      ),
    }"
  >
    <AppSidebar
      :current="current"
      :menus="menus"
      :user="session.user"
      :mobile-open="mobileOpen"
      @close="mobileOpen = false"
    />
    <div class="app-main" :inert="mobileOpen">
      <AppHeader
        :title="route.meta.title"
        :user="session.user"
        :menu-open="mobileOpen"
        :busy="busy"
        @menu="mobileOpen = true"
        @navigate="router.push($event)"
        @logout="logout"
      />
      <main id="main" class="page-content" tabindex="-1">
        <p v-if="logoutError" role="alert" class="form-error">
          {{ logoutError }}
        </p>
        <div v-if="notification" role="status" class="toast">
          <span>{{ notification }}</span
          ><button
            class="icon-button"
            aria-label="알림 닫기"
            @click="notification = ''"
          >
            ×
          </button>
        </div>
        <SceneBanner
          v-if="
            route.path === '/songs' ||
            /^\/songs\/[1-9]\d*$/.test(route.path) ||
            /^\/admin\/songs(?:\/new|\/[1-9]\d*\/edit)?$/.test(route.path)
          "
        />
        <RouterView :key="route.path" />
      </main>
      <footer class="site-footer">
        <span>작은 노래가 모이는 곳, ZIO HOME</span
        ><span>© {{ new Date().getFullYear() }} ZIO HOME</span>
      </footer>
    </div>
  </div>
</template>
