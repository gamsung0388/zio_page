<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { api } from "../services/api.js";
import { toSongView } from "../services/song-adapter.js";
import HomeView from "../views/HomeView.vue";
const songs = ref([]),
  loading = ref(true),
  error = ref(""),
  router = useRouter();
let controller;
async function load() {
  controller?.abort();
  controller = new AbortController();
  const request = controller;
  loading.value = true;
  error.value = "";
  try {
    const data = await api("/songs?page_size=4&sort=recent", {
      signal: request.signal,
    });
    songs.value = data.items.map((song) => toSongView(song));
  } catch (err) {
    if (err.name !== "AbortError") error.value = err.message;
  } finally {
    if (controller === request) loading.value = false;
  }
}
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <HomeView
    connected
    :songs="songs"
    :loading="loading"
    :error="error"
    @retry="load"
    @navigate="router.push($event.replace(/^#/, ''))"
  />
</template>
