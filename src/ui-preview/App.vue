<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import AppSidebar from "../components/AppSidebar.vue";
import AppHeader from "../components/AppHeader.vue";
import HomeView from "../views/HomeView.vue";
import SongsView from "../views/SongsView.vue";
import SongDetailView from "../views/SongDetailView.vue";
import SongFormView from "../views/SongFormView.vue";
import AboutView from "../views/AboutView.vue";
import {
  createSong,
  deleteSong,
  listSongs,
  updateSong,
} from "./songService.js";
function parseRoute() {
  const path = window.location.hash.replace(/^#\/?/, "").replace(/\/+$/, "");
  if (!path) return { kind: "home" };
  if (path === "songs" || path === "manage") return { kind: path };
  if (path === "songs/new") return { kind: "new" };
  const edit = path.match(/^songs\/([^/]+)\/edit$/);
  if (edit) return { kind: "edit", id: decodeURIComponent(edit[1]) };
  const detail = path.match(/^songs\/([^/]+)$/);
  if (detail) return { kind: "detail", id: decodeURIComponent(detail[1]) };
  if (path === "about") return { kind: "about" };
  return { kind: "not-found" };
}
const route = ref(parseRoute()),
  songs = ref([]),
  menuOpen = ref(false),
  toast = ref("");
const editingPreview = ref(false);
let toastTimer;
const publicSongs = computed(() =>
  songs.value.filter((song) => song.isPublic !== false),
);
const selectedSong = computed(
  () =>
    songs.value.find(
      (song) =>
        song.id === route.value.id &&
        (adminPreview.value || song.isPublic !== false),
    ) ?? null,
);
const adminPreview = computed(
  () =>
    ["manage", "new", "edit"].includes(route.value.kind) ||
    (route.value.kind === "detail" && editingPreview.value),
);
const navSection = computed(() =>
  adminPreview.value
    ? "manage"
    : ["songs", "detail"].includes(route.value.kind)
      ? "songs"
      : route.value.kind,
);
const pageTitle = computed(
  () =>
    ({
      home: "홈",
      songs: "노래책자",
      manage: "노래 관리",
      detail: "노래 상세",
      new: "노래 등록",
      edit: "노래 수정",
      about: "지오 소개",
    })[route.value.kind] || "ZIO HOME",
);
function syncRoute() {
  route.value = parseRoute();
  if (["home", "songs", "about"].includes(route.value.kind))
    editingPreview.value = false;
  if (["manage", "new", "edit"].includes(route.value.kind))
    editingPreview.value = true;
  menuOpen.value = false;
  document.title = pageTitle.value + " · ZIO HOME UI 미리보기";
  window.scrollTo({ top: 0, behavior: "auto" });
}
function navigate(hash) {
  if (window.location.hash === hash) syncRoute();
  else window.location.hash = hash;
}
function openSong(id) {
  navigate("#/songs/" + encodeURIComponent(id));
}
function notify(message) {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ""), 6000);
}
async function refreshSongs() {
  songs.value = await listSongs();
}
async function saveSong(payload) {
  const saved =
    route.value.kind === "edit"
      ? await updateSong(route.value.id, payload)
      : await createSong(payload);
  await refreshSongs();
  editingPreview.value = true;
  openSong(saved.id);
  notify(
    "미리보기에만 반영했습니다. 새로고침하면 초기화되며 실제 곡은 변경하지 않습니다.",
  );
}
async function removeSong() {
  if (
    !selectedSong.value ||
    !window.confirm("이 예시 곡을 미리보기에서 삭제할까요?")
  )
    return;
  await deleteSong(route.value.id);
  await refreshSongs();
  navigate("#/manage");
  notify("미리보기에서 삭제했습니다. 실제 곡은 변경하지 않습니다.");
}
onMounted(() => {
  window.addEventListener("hashchange", syncRoute);
  syncRoute();
  refreshSongs();
});
onUnmounted(() => {
  window.removeEventListener("hashchange", syncRoute);
  clearTimeout(toastTimer);
});
</script>
<template>
  <a class="skip-link" href="#main-content">본문 바로가기</a>
  <div class="app-shell">
    <AppSidebar
      preview
      :current="navSection"
      :mobile-open="menuOpen"
      @close="menuOpen = false"
      @navigate="navigate"
    />
    <div class="app-main" :inert="menuOpen">
      <AppHeader
        preview
        :title="pageTitle"
        :menu-open="menuOpen"
        @menu="menuOpen = true"
        @navigate="navigate"
      />
      <div class="preview-banner" role="status">
        <span class="preview-banner-dot"></span><strong>UI 미리보기</strong
        ><span
          >예시 곡으로 화면만 확인합니다. 실제 데이터는 변경되지 않습니다.</span
        >
      </div>
      <main class="page-content" id="main-content" tabindex="-1">
        <HomeView
          v-if="route.kind === 'home'"
          :songs="publicSongs"
          @navigate="navigate"
          @open="openSong"
        />
        <SongsView
          v-else-if="['songs', 'manage'].includes(route.kind)"
          :key="route.kind"
          :songs="adminPreview ? songs : publicSongs"
          :admin-preview="adminPreview"
          @open="openSong"
          @add="navigate('#/songs/new')"
        />
        <SongDetailView
          v-else-if="route.kind === 'detail' && selectedSong"
          :song="selectedSong"
          :admin-preview="adminPreview"
          @navigate="navigate"
          @edit="navigate('#/songs/' + encodeURIComponent(route.id) + '/edit')"
          @delete="removeSong"
        />
        <SongFormView
          v-else-if="
            route.kind === 'new' || (route.kind === 'edit' && selectedSong)
          "
          :key="route.kind + '-' + (route.id || '')"
          :song="route.kind === 'edit' ? selectedSong : null"
          @save="saveSong"
          @cancel="navigate('#/manage')"
        />
        <AboutView v-else-if="route.kind === 'about'" />
        <div v-else class="empty-state card">
          <h1>페이지를 찾을 수 없어요</h1>
          <p>요청한 예시 곡이나 화면이 없습니다.</p>
          <button class="btn btn-primary" @click="navigate('#/songs')">
            노래책자로 돌아가기
          </button>
        </div>
      </main>
      <footer class="site-footer">
        <span>© ZIO HOME · 작은 음악 공간</span
        ><span>화면 확인용 예시 데이터</span>
      </footer>
    </div>
    <div v-if="toast" class="toast" role="status" aria-live="polite">
      {{ toast }}<button aria-label="알림 닫기" @click="toast = ''">×</button>
    </div>
  </div>
</template>
