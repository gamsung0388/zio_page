<script setup>
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
