<script setup>
import GuideLink from "../components/guide/GuideLink.vue";
import { songGuideLink } from "../services/song-guide.js";
import { updateAdminSong, removeAdminSong } from "../services/song-admin.js";
import { useRoute, useRouter } from "vue-router";
import { notification, notify } from "../services/notifications.js";
import { toSongView } from "../services/song-adapter.js";
import { ref } from "vue";
import { api, session, downloadBlob } from "../services/api.js";
import { useSongs } from "../services/useSongs.js";
import { sortLabels, formatNumber } from "../services/song-labels.js";
import Icon from "../components/Icon.vue";
import Notice from "../components/Notice.vue";
import SongFilters from "../components/SongFilters.vue";
import SongCard from "../components/SongCard.vue";
import CsvImport from "../components/CsvImport.vue";
import Modal from "../components/Modal.vue";
import Pagination from "../components/Pagination.vue";
const {
  items,
  total,
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
    if (items.value.length === 1 && page.value > 1) {
      update("page", page.value - 1);
      notify("노래를 삭제했습니다.");
    } else saved("노래를 삭제했습니다.");
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
        >곡 <span class="muted">· 비공개 포함</span>
      </p>
      <div>
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
        title="등록된 노래가 없어요"
        message="새 노래를 등록하거나 CSV 파일을 가져와 노래책자를 채워보세요."
        @retry="load"
      />
      <div
        v-if="!loading && !error && items.length"
        class="song-grid admin-song-grid"
      >
        <article v-for="song in items" :key="song.id" class="managed-song">
          <SongCard :song="toSongView(song)" @open="edit(song)" />
          <div class="song-management-actions">
            <span
              class="visibility-label"
              :class="{ 'is-private': !song.is_public }"
              >{{ song.is_public ? "공개" : "비공개" }}</span
            >
            <button
              :disabled="busy"
              :aria-label="song.title + ' 수정'"
              @click="edit(song)"
            >
              수정
            </button>
            <button
              :disabled="busy"
              :aria-label="
                song.title +
                (song.is_public ? ' 비공개로 전환' : ' 공개로 전환')
              "
              @click="toggle(song)"
            >
              {{ song.is_public ? "비공개" : "공개" }}
            </button>
            <button
              :disabled="busy"
              class="delete-song"
              :aria-label="song.title + ' 삭제'"
              @click="
                deleting = song;
                deleteError = '';
              "
            >
              삭제
            </button>
          </div>
        </article>
      </div>
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
    /><Modal
      v-if="deleting"
      title="노래를 삭제할까요?"
      :busy="busy"
      @close="deleting = null"
      ><p class="modal-intro">
        <strong>{{ deleting.title }}</strong> · {{ deleting.artist
        }}<br />삭제한 곡은 되돌릴 수 없습니다.
      </p>
      <p v-if="deleteError" role="alert" class="form-error">
        {{ deleteError }}
      </p>
      <div class="modal-actions">
        <button
          class="button secondary"
          :disabled="busy"
          @click="deleting = null"
        >
          취소</button
        ><button class="button destructive" :disabled="busy" @click="remove">
          {{ busy ? "삭제 중…" : "삭제하기" }}
        </button>
      </div></Modal
    >
  </div>
</template>
