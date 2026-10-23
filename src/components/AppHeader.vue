<script setup>
import { ALBUM_LAB_PATH, isAlbumLabOwner } from "../../shared/album-lab.js";
import ThemePicker from "./ThemePicker.vue";
import { RouterLink } from "vue-router";
defineProps({
  title: { type: String, default: "지오의 작은 음악 공간" },
  menuOpen: Boolean,
  preview: Boolean,
  user: Object,
  busy: Boolean,
});
const emit = defineEmits(["menu", "navigate", "logout"]);
</script>
<template>
  <header class="topbar">
    <button
      class="mobile-menu-button icon-button"
      aria-label="메뉴 열기"
      aria-controls="preview-sidebar"
      :aria-expanded="menuOpen"
      @click="emit('menu')"
    >
      ☰
    </button>
    <div class="topbar-breadcrumb">
      <span class="topbar-dot"></span>{{ title }}
    </div>
    <div class="topbar-right">
      <a
        v-if="!preview && isAlbumLabOwner(user)"
        :href="ALBUM_LAB_PATH"
        class="lab-icon"
        aria-label="앨범 연결 실험실"
        title="앨범 연결 실험실"
        ><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            d="M9 3h6M10 3v6l-6 10a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M7 15h10"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
      ></a>
      <ThemePicker v-if="!preview" />
      <span v-if="preview" class="demo-label">UI PREVIEW</span
      ><template v-else
        ><span v-if="user" class="session-name">{{
          user.display_name || user.username
        }}</span
        ><button
          v-if="user"
          class="text-button"
          :disabled="busy"
          @click="emit('logout')"
        >
          {{ busy ? "로그아웃 중…" : "로그아웃" }}</button
        ><RouterLink v-else to="/admin/login" class="text-button"
          >관리자 로그인</RouterLink
        ></template
      ><button
        class="avatar-button"
        aria-label="지오 소개"
        @click="emit('navigate', preview ? '#/about' : '/about')"
      >
        <img src="/images/zio-reference.png" alt="지오" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.lab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 36px;
  color: var(--muted, #647a6c);
  border-radius: 8px;
  opacity: 0.55;
}
.lab-icon:hover,
.lab-icon:focus-visible {
  opacity: 1;
  background: var(--canvas, #f7f8f4);
  outline: 2px solid var(--accent, #8fc36a);
  outline-offset: 2px;
}
</style>
