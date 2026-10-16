<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../services/api.js";
import { toSongView } from "../services/song-adapter.js";
import SongDetailView from "../views/SongDetailView.vue";
import Notice from "../components/Notice.vue";
const route = useRoute(),
  router = useRouter(),
  song = ref(null),
  loading = ref(true),
  error = ref(""),
  missing = ref(false);
const controller = new AbortController();
async function load() {
  loading.value = true;
  error.value = "";
  missing.value = false;
  song.value = null;
  try {
    song.value = toSongView(
      await api("/songs/" + encodeURIComponent(route.params.id), {
        signal: controller.signal,
      }),
    );
    document.title = song.value.title + " · ZIO HOME";
  } catch (err) {
    if (err.status === 404) missing.value = true;
    else if (err.name !== "AbortError") error.value = err.message;
  } finally {
    loading.value = false;
  }
}
function back() {
  const target = route.query.returnTo;
  router.push(
    typeof target === "string" && /^\/songs(?:\?|$)/.test(target)
      ? target
      : "/songs",
  );
}
onMounted(load);
onBeforeUnmount(() => controller.abort());
</script>
<template>
  <Notice :loading="loading" :error="error" @retry="load" />
  <section v-if="missing" class="card empty-state">
    <h1>노래를 찾을 수 없어요</h1>
    <p>삭제되었거나 공개되지 않은 노래입니다.</p>
    <RouterLink class="btn btn-primary" to="/songs">노래책자 보기</RouterLink>
  </section>
  <SongDetailView
    v-if="song && !loading && !error"
    :song="song"
    connected
    @navigate="back"
  />
</template>
