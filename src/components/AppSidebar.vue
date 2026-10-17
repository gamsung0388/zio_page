<script setup>
import { computed } from "vue";
import {
  defaultNavigation,
  menuPresentation,
} from "../../shared/navigation.js";
import { administrationLinks } from "../services/admin-navigation.js";
import MenuLink from "./MenuLink.vue";
import Icon from "./Icon.vue";
import { RouterLink } from "vue-router";
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from "vue";
const props = defineProps({
  current: { type: String, default: "home" },
  mobileOpen: Boolean,
  preview: Boolean,
  user: Object,
  menus: Array,
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
const items = computed(() =>
  (props.preview
    ? defaultNavigation().filter((item) =>
        ["home", "songs", "manage", "soop"].includes(item.id),
      )
    : props.menus || defaultNavigation()
  )
    .filter((item) => item.visible)
    .map(menuPresentation),
);
const groups = computed(() =>
  [
    {
      id: "public",
      title: "지오의 공간",
      items: items.value.filter((item) => item.area === "public"),
    },
    ...(props.user || props.preview
      ? [
          {
            id: "work",
            title: "운영",
            items: items.value.filter((item) => item.area === "work"),
          },
        ]
      : []),
  ].filter((group) => group.items.length),
);
const shortcuts = computed(() =>
  items.value.filter((item) => item.area === "footer"),
);
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
      <div
        v-for="group in groups"
        :key="group.id"
        class="sidebar-group"
        role="group"
        :aria-labelledby="'sidebar-group-' + group.id"
      >
        <h2 :id="'sidebar-group-' + group.id" class="sidebar-group-title">
          {{ group.title }}
        </h2>
        <MenuLink
          v-for="item in group.items"
          :key="item.id"
          :item="item"
          :active="current === item.id"
          :preview="preview"
          class="sidebar-item"
          @navigate="emit('navigate', $event)"
          @close="emit('close')"
        />
      </div>
      <div
        v-if="!preview && user"
        class="sidebar-group"
        role="group"
        aria-labelledby="sidebar-group-management"
      >
        <h2 id="sidebar-group-management" class="sidebar-group-title">
          <RouterLink
            to="/admin"
            :aria-current="current === 'administration' ? 'page' : undefined"
            @click="emit('close')"
            >관리<Icon name="arrow" :size="12"
          /></RouterLink>
        </h2>
        <div class="sidebar-management-children">
          <MenuLink
            v-for="item in administrationLinks"
            :key="item.id"
            :item="item"
            :active="current === item.id"
            class="sidebar-item"
            @close="emit('close')"
          />
        </div>
      </div>
      <button
        v-if="preview"
        class="sidebar-item sidebar-unavailable"
        disabled
        title="관리자 계정 화면은 기존 서비스에서 유지합니다"
      >
        <Icon name="users" :size="19" /><span
          >관리자 관리<small>기존 화면 유지</small></span
        >
      </button>
    </nav>
    <div v-if="shortcuts.length" class="sidebar-divider"></div>
    <div class="sidebar-shortcuts">
      <MenuLink
        v-for="item in shortcuts"
        :key="item.id"
        :item="item"
        class="sidebar-shortcut"
        :class="{ 'sidebar-soop': item.id === 'soop' }"
        @close="emit('close')"
      />
    </div>
    <div class="sidebar-bottom">
      <img
        class="sidebar-bottom-image"
        src="/images/zio-reference.png"
        alt=""
      />
      <p>오늘도<br />좋은 하루 되세요 <span class="sidebar-sprout">✿</span></p>
      <small>— 지오 —</small>
    </div>
  </aside>
</template>
