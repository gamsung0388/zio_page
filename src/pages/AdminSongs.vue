<script setup>
import GuideLink from "../components/guide/GuideLink.vue";
import { songGuideLink } from "../services/song-guide.js";
import { updateAdminSong, removeAdminSong } from "../services/song-admin.js";
import { useRoute, useRouter } from "vue-router";
import { notification, notify } from "../services/notifications.js";
import { computed, ref } from "vue";
import { api, session, downloadBlob } from "../services/api.js";
import { useSongs } from "../services/useSongs.js";
import { sortLabels, formatNumber } from "../services/song-labels.js";
import Icon from "../components/Icon.vue";
import Notice from "../components/Notice.vue";
import SongFilters from "../components/SongFilters.vue";
import AdminSongCollection from "../components/AdminSongCollection.vue";
import { useSongLayout } from "../services/useSongLayout.js";
import CsvImport from "../components/CsvImport.vue";
import DeleteConfirmation from "../components/DeleteConfirmation.vue";
import Pagination from "../components/Pagination.vue";
const {
  items,
  total,
  hasFilters,
  emptyInfo,
  loading,
  error,
  filters,
  facets,
  page,
  pageSize,
  pages,
  load,
  update,
  search,
  reset,
} = useSongs(true);
const route = useRoute(),
  router = useRouter();
function edit(song) {
  router.push({
    path: song ? "/admin/songs/" + song.id + "/edit" : "/admin/songs/new",
    query: { returnTo: route.fullPath },
  });
}
const { desktop, layout, select } = useSongLayout();
const visibilitySummary = computed(() =>
  filters.is_public === "true"
    ? "공개 곡만"
    : filters.is_public === "false"
      ? "비공개 곡만"
      : "비공개 포함",
);
function openDelete(song) {
  deleting.value = song;
  deleteError.value = "";
}
const importing = ref(false),
  deleting = ref(null),
  busy = ref(false),
  toast = notification,
  actionError = ref(""),
  deleteError = ref("");
function saved(message) {
  importing.value = false;
  notify(message);
  actionError.value = "";
  load(true);
}
async function toggle(song) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = "";
  toast.value = "";
  try {
    await updateAdminSong(song.id, song.revision, {
      is_public: !song.is_public,
    });
    saved(song.is_public ? "비공개로 변경했습니다." : "공개로 변경했습니다.");
  } catch (err) {
    actionError.value =
      err.code === "SONG_CONFLICT"
        ? "노래가 변경됐어요. 최신 목록을 불러왔으니 내용을 확인하고 다시 선택해주세요."
        : err.message;
    if (err.code === "SONG_CONFLICT") await load();
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (busy.value) return;
  busy.value = true;
  deleteError.value = "";
  try {
    await removeAdminSong(deleting.value);
    deleting.value = null;
    saved("노래를 삭제했습니다.");
  } catch (err) {
    deleteError.value =
      err.code === "SONG_CONFLICT"
        ? "노래가 변경됐어요. 삭제 창을 닫고 최신 목록에서 다시 선택해주세요."
        : err.message;
    if (err.code === "SONG_CONFLICT") await load();
  } finally {
    busy.value = false;
  }
}
async function backup() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = "";
  toast.value = "";
  try {
    const blob = await api("/admin/songs/export.csv", { download: true });
    downloadBlob(
      blob,
      `zio-songs-backup-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    notify("전체 노래와 관리자 메모를 백업했습니다.");
  } catch (err) {
    actionError.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="container page admin-page">
    <div class="breadcrumb">
      <RouterLink to="/">홈</RouterLink><span>/</span>노래 관리
    </div>
    <div class="page-heading song-heading">
      <div>
        <span class="eyebrow">MANAGE YOUR SONGBOOK</span>
        <h1>노래책자 관리<span class="green-period">.</span></h1>
        <p>
          {{ session.user?.display_name || session.user?.username }}님, 오늘은
          어떤 노래를 담아볼까요?
        </p>
      </div>
      <div class="song-heading-actions">
        <GuideLink
          :to="songGuideLink(route.fullPath, true)"
          label="등록·관리 가이드"
        />
        <button class="button primary" :disabled="busy" @click="edit()">
          <Icon name="plus" :size="19" />새 노래 등록
        </button>
      </div>
    </div>
    <div class="admin-tools">
      <span><Icon name="music" :size="16" />노래책자 · CSV 관리</span>
      <div>
        <button
          class="button secondary small"
          :disabled="busy"
          @click="importing = true"
        >
          <Icon name="upload" :size="16" />CSV 가져오기</button
        ><button
          class="button secondary small"
          :disabled="busy"
          @click="backup"
        >
          <Icon name="download" :size="16" />전체 CSV 백업
        </button>
      </div>
    </div>
    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    <SongFilters
      :filters="filters"
      :facets="facets"
      admin
      @update="update"
      @search="search"
      @reset="reset"
    />
    <div class="results-toolbar">
      <p role="status">
        총 <strong>{{ formatNumber(total) }}</strong
        >곡 <span class="muted">· {{ visibilitySummary }}</span>
      </p>
      <div>
        <div
          v-if="desktop"
          class="song-layout-switch"
          role="group"
          aria-label="노래 보기 방식"
        >
          <button
            type="button"
            :aria-pressed="layout === 'list'"
            @click="select('list')"
          >
            <Icon name="list" :size="16" />목록 보기
          </button>
          <button
            type="button"
            :aria-pressed="layout === 'cards'"
            @click="select('cards')"
          >
            <Icon name="layout" :size="16" />카드 보기
          </button>
        </div>
        <label
          ><span class="sr-only">페이지당 노래 수</span
          ><select
            :value="pageSize"
            @change="update('page_size', $event.target.value)"
          >
            <option :value="20">20곡씩</option>
            <option :value="50">50곡씩</option>
            <option :value="100">100곡씩</option>
          </select></label
        ><label
          ><span class="sr-only">정렬</span
          ><select
            :value="filters.sort"
            @change="update('sort', $event.target.value)"
          >
            <option
              v-for="(label, value) in sortLabels"
              :key="value"
              :value="value"
            >
              {{ label }}
            </option>
          </select></label
        >
      </div>
    </div>
    <div class="results-panel" :aria-busy="loading">
      <Notice
        :loading="loading"
        :error="error"
        :empty="!items.length"
        :title="emptyInfo.title"
        :message="emptyInfo.message"
        @retry="load"
        ><button
          v-if="hasFilters"
          class="text-button"
          type="button"
          @click="reset"
        >
          필터 초기화
        </button></Notice
      >
      <AdminSongCollection
        v-if="!loading && !error && items.length"
        :items="items"
        :busy="busy"
        :list="layout === 'list'"
        @edit="edit"
        @toggle="toggle"
        @delete="openDelete"
      />
    </div>
    <Pagination
      :page="page"
      :pages="pages"
      :disabled="loading"
      @change="update('page', $event)"
    />
    <p class="form-hint">
      CSV 백업에는 비공개 곡과 관리자 메모가 포함됩니다. 안전한 위치에
      보관해주세요.
    </p>
    <CsvImport
      v-if="importing"
      @close="importing = false"
      @imported="saved"
    /><DeleteConfirmation
      v-if="deleting"
      title="노래를 삭제할까요?"
      :busy="busy"
      :error="deleteError"
      @close="deleting = null"
      @confirm="remove"
      ><strong>{{ deleting.title }}</strong> · {{ deleting.artist }}<br />삭제한
      곡은 되돌릴 수 없습니다.
    </DeleteConfirmation>
  </div>
</template>
