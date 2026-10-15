<script setup>
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { api } from "../services/api.js";
import { formatNumber } from "../services/song-labels.js";
import SongBadges from "../components/SongBadges.vue";
import Notice from "../components/Notice.vue";
import Icon from "../components/Icon.vue";
const route = useRoute();
const song = ref(null),
  loading = ref(true),
  error = ref(""),
  missing = ref(false);
async function load() {
  loading.value = true;
  error.value = "";
  missing.value = false;
  try {
    song.value = await api(`/songs/${encodeURIComponent(route.params.id)}`);
    document.title = `${song.value.title} · ZIO HOME`;
  } catch (err) {
    if (err.status === 404) missing.value = true;
    else error.value = err.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="container page detail-page">
    <RouterLink to="/songs" class="text-button back-link"
      ><Icon name="back" :size="18" />노래책자로 돌아가기</RouterLink
    ><Notice :loading="loading" :error="error" @retry="load" />
    <div v-if="missing" class="notice">
      <h1>노래를 찾을 수 없어요</h1>
      <p>삭제되었거나 공개되지 않은 노래입니다.</p>
      <RouterLink class="button primary" to="/songs">노래책자 보기</RouterLink>
    </div>
    <article v-if="song && !error && !loading" class="detail-card">
      <div class="detail-art" aria-hidden="true">
        <div class="mini-record"><Icon name="music" :size="42" /></div>
      </div>
      <div class="detail-content">
        <span class="eyebrow">FROM ZIO'S SONGBOOK</span>
        <h1>{{ song.title }}</h1>
        <p class="detail-artist">{{ song.artist }}</p>
        <div class="detail-badges"><SongBadges :song="song" /></div>
        <dl class="detail-meta">
          <div>
            <dt>장르</dt>
            <dd>{{ song.genre || "미지정" }}</dd>
          </div>
          <div>
            <dt>언어</dt>
            <dd>{{ song.language || "미지정" }}</dd>
          </div>
        </dl>
        <div class="detail-description">
          <h2>이 노래에 대해</h2>
          <p>{{ song.description || "아직 등록된 설명이 없어요." }}</p>
        </div>
        <div class="detail-cost">
          <span><Icon name="balloon" :size="23" />신청에 필요한 풍</span
          ><strong
            >{{ formatNumber(song.balloon_cost) }}<small>개</small></strong
          >
        </div>
        <p class="muted small">
          풍 개수 안내이며, 실제 신청은 방송의 안내를 따라주세요.
        </p>
      </div>
    </article>
  </div>
</template>
