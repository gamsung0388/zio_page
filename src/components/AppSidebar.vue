<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
const props = defineProps({
  current: { type: String, default: "home" },
  mobileOpen: Boolean,
  preview: Boolean,
  user: Object,
});
const emit = defineEmits(["navigate", "close"]);
const panel = ref(null);
const media = window.matchMedia("(max-width: 920px)");
const narrow = ref(media.matches);
function resized(event) {
  narrow.value = event.matches;
  if (!event.matches) emit("close");
}
onMounted(() => media.addEventListener("change", resized));
let previousFocus,
  previousOverflow = "";
const items = computed(() => [
  { id: "home", label: "홈", icon: "⌂", hash: "#/", to: "/" },
  { id: "songs", label: "노래책자", icon: "♫", hash: "#/songs", to: "/songs" },
  ...(props.preview || props.user
    ? [
        {
          id: "manage",
          label: "노래 관리",
          icon: "✎",
          hash: "#/manage",
          to: "/admin/songs",
        },
      ]
    : []),
  ...(!props.preview && props.user
    ? [{ id: "schedule", label: "일정 관리", icon: "▦", to: "/admin/schedule" }]
    : []),
  ...(!props.preview && props.user
    ? [{ id: "accounts", label: "관리자 관리", icon: "♙", to: "/admin" }]
    : []),
]);
watch(
  () => props.mobileOpen,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      await nextTick();
      panel.value?.querySelector(".sidebar-close")?.focus();
    } else {
      document.body.style.overflow = previousOverflow;
      await nextTick();
      previousFocus?.focus();
    }
  },
);
function trap(event) {
  if (!props.mobileOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const controls = [
    ...panel.value.querySelectorAll("button:not(:disabled),a[href]"),
  ];
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
onBeforeUnmount(() => {
  media.removeEventListener("change", resized);
  if (props.mobileOpen) document.body.style.overflow = previousOverflow;
});
</script>
<template>
  <div
    v-if="mobileOpen"
    class="sidebar-backdrop"
    aria-hidden="true"
    @click="emit('close')"
  ></div>
  <aside
    id="preview-sidebar"
    ref="panel"
    :inert="narrow && !mobileOpen"
    class="sidebar"
    :class="{ 'is-open': mobileOpen }"
    :role="mobileOpen ? 'dialog' : undefined"
    :aria-modal="mobileOpen ? true : undefined"
    aria-label="메뉴 패널"
    @keydown="trap"
  >
    <button class="sidebar-close" aria-label="메뉴 닫기" @click="emit('close')">
      ×
    </button>
    <component
      :is="preview ? 'button' : RouterLink"
      class="sidebar-brand"
      :to="preview ? undefined : '/'"
      aria-label="ZIO HOME 홈"
      @click="preview ? emit('navigate', '#/') : emit('close')"
      ><span class="sidebar-brand-title">ZIO <span>HOME</span></span
      ><span class="sidebar-brand-desc">지오의 작은 음악 공간</span></component
    >
    <nav class="sidebar-nav" aria-label="주 메뉴">
      <component
        :is="preview ? 'button' : RouterLink"
        v-for="item in items"
        :to="preview ? undefined : item.to"
        active-class=""
        exact-active-class=""
        :key="item.id"
        class="sidebar-item"
        :class="{ active: current === item.id }"
        :aria-current="current === item.id ? 'page' : undefined"
        @click="preview ? emit('navigate', item.hash) : emit('close')"
        ><span class="sidebar-item-icon" aria-hidden="true">{{
          item.icon
        }}</span
        >{{ item.label }}</component
      >
      <button
        v-if="preview"
        class="sidebar-item sidebar-unavailable"
        disabled
        title="관리자 계정 화면은 기존 서비스에서 유지합니다"
      >
        <span class="sidebar-item-icon" aria-hidden="true">♙</span
        ><span>관리자 관리<small>기존 화면 유지</small></span>
      </button>
    </nav>
    <div class="sidebar-divider"></div>
    <a
      class="sidebar-soop"
      href="https://www.sooplive.com/station/bluejin0129"
      target="_blank"
      rel="noopener noreferrer"
      >SOOP 방송국 ↗</a
    >
    <div class="sidebar-bottom">
      <div class="sidebar-mascot" aria-hidden="true">🐼</div>
      <p>오늘도<br />좋은 하루 되세요 <span class="sidebar-sprout">✿</span></p>
      <small>— 지오 —</small>
    </div>
  </aside>
</template>
