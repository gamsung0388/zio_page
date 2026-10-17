<script setup>
import GuideLink from "../components/guide/GuideLink.vue";
import { songGuideLink } from "../services/song-guide.js";
import { ref, onMounted, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { getAdminSong, saveAdminSong } from "../services/song-admin.js";
import SongConflictReview from "../components/SongConflictReview.vue";
import { useEditorGuard } from "../services/editor-guards.js";
import { notify } from "../services/notifications.js";
import SongFormView from "../views/SongFormView.vue";
import Notice from "../components/Notice.vue";
const route = useRoute(),
  router = useRouter(),
  song = ref(null),
  loading = ref(Boolean(route.params.id)),
  error = ref(""),
  editor = ref(null),
  conflict = ref(false),
  review = ref(null),
  reviewBase = ref(null),
  reviewBusy = ref(false),
  reviewError = ref("");
const controller = new AbortController();
useEditorGuard(() => editor.value?.dirty || editor.value?.busy);
function destination() {
  const value = route.query.returnTo;
  return typeof value === "string" && /^\/admin\/songs(?:\?|$)/.test(value)
    ? value
    : "/admin/songs";
}
async function load() {
  if (!route.params.id) return;
  loading.value = true;
  error.value = "";
  try {
    song.value = await getAdminSong(route.params.id, {
      signal: controller.signal,
    });
    reviewBase.value = song.value;
  } catch (err) {
    if (err.name !== "AbortError") error.value = err.message;
  } finally {
    loading.value = false;
  }
}
async function save(draft) {
  try {
    if (song.value && !draft.sourceRevision) {
      const error = new Error(
        "이전 초안이에요. 저장된 내용과 비교한 뒤 다시 저장해주세요.",
      );
      error.code = "SONG_CONFLICT";
      throw error;
    }
    await saveAdminSong(song.value?.id, draft);
  } catch (err) {
    if (err.code === "SONG_CONFLICT") conflict.value = true;
    throw err;
  }
  const message = song.value
    ? "노래를 수정했습니다."
    : "새 노래를 등록했습니다.";
  editor.value.markSaved();
  await router.push(destination());
  notify(message);
}
async function compare() {
  if (reviewBusy.value || editor.value?.busy) return;
  reviewBusy.value = true;
  reviewError.value = "";
  try {
    const latest = await getAdminSong(song.value.id, {
      signal: controller.signal,
    });
    const draft = editor.value.currentDraft();
    const base =
      reviewBase.value?.revision === draft.sourceRevision
        ? reviewBase.value
        : null;
    review.value = { base, draft, latest };
  } catch (err) {
    if (err.name !== "AbortError")
      reviewError.value =
        err.status === 404
          ? "이 노래는 삭제됐어요. 현재 입력은 유지됩니다. 내용을 보관한 뒤 목록을 확인해주세요."
          : err.message;
  } finally {
    reviewBusy.value = false;
  }
}
function applyReview(draft) {
  editor.value.applyReview(draft);
  reviewBase.value = review.value.latest;
  review.value = null;
  conflict.value = false;
  notify("비교한 내용으로 편집을 계속합니다. 저장 버튼을 눌러야 반영돼요.");
}
function confirmLeave() {
  if (
    editor.value?.dirty &&
    !window.confirm("저장하지 않은 변경 내용이 있어요. 목록으로 이동할까요?")
  )
    return false;
  editor.value?.discardDraft();
  return true;
}
onBeforeRouteLeave((to) => {
  if (to.path === "/admin/login" || to.path === "/admin/password") return true;
  if (editor.value?.busy && editor.value?.dirty) return false;
  return confirmLeave();
});
function beforeUnload(event) {
  if (editor.value?.dirty || editor.value?.busy) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  load();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => {
  controller.abort();
  window.removeEventListener("beforeunload", beforeUnload);
});
</script>
<template>
  <Notice :loading="loading" :error="error" @retry="load" />
  <SongConflictReview
    v-if="review"
    v-bind="review"
    @close="review = null"
    @apply="applyReview"
  />
  <SongFormView
    v-if="!loading && !error"
    ref="editor"
    :song="song"
    :draft-scope="'song:' + (route.params.id || 'new')"
    connected
    :save-action="save"
    @cancel="router.push(destination())"
  >
    <template #guide>
      <GuideLink
        :to="songGuideLink(route.fullPath, true)"
        label="등록 가이드"
        new-tab
      />
    </template>
    <template #save-error>
      <div
        v-if="conflict"
        class="card song-conflict-notice"
        role="region"
        aria-label="노래 변경 충돌 안내"
      >
        <p>
          다른 곳에서 저장된 내용이 있어요. 내 입력은 유지됩니다. 최신 내용과
          비교해 다시 저장하세요.
        </p>
        <button
          type="button"
          class="button secondary"
          :disabled="reviewBusy || editor?.busy"
          @click="compare"
        >
          {{ reviewBusy ? "불러오는 중…" : "저장된 내용과 비교" }}
        </button>
        <p v-if="reviewError" class="form-error" role="alert">
          {{ reviewError }}
        </p>
      </div>
    </template>
  </SongFormView>
</template>

<style scoped>
.song-conflict-notice {
  padding: 20px;
  margin-bottom: 20px;
}
</style>
