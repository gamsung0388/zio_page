<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { api } from "../services/api.js";
import { toSongView, toSongInput } from "../services/song-adapter.js";
import { useEditorGuard } from "../services/editor-guards.js";
import { notify } from "../services/notifications.js";
import SongFormView from "../views/SongFormView.vue";
import Notice from "../components/Notice.vue";
const route = useRoute(),
  router = useRouter(),
  song = ref(null),
  loading = ref(Boolean(route.params.id)),
  error = ref(""),
  editor = ref(null);
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
    song.value = toSongView(
      await api("/admin/songs/" + encodeURIComponent(route.params.id), {
        signal: controller.signal,
      }),
      { admin: true },
    );
  } catch (err) {
    if (err.name !== "AbortError") error.value = err.message;
  } finally {
    loading.value = false;
  }
}
async function save(draft) {
  await api("/admin/songs" + (song.value ? "/" + song.value.id : ""), {
    method: song.value ? "PATCH" : "POST",
    body: toSongInput(draft, { admin: true }),
  });
  const message = song.value
    ? "노래를 수정했습니다."
    : "새 노래를 등록했습니다.";
  editor.value.markSaved();
  await router.push(destination());
  notify(message);
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
  <Notice :loading="loading" :error="error" @retry="load" /><SongFormView
    v-if="!loading && !error"
    ref="editor"
    :song="song"
    :draft-scope="'song:' + (route.params.id || 'new')"
    connected
    :save-action="save"
    @cancel="router.push(destination())"
  />
</template>
