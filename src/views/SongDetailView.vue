<script setup>
import CoverImage from "../components/CoverImage.vue";
import LeafRating from "../components/LeafRating.vue";
import StatusPill from "../components/StatusPill.vue";
defineProps({
  song: { type: Object, required: true },
  adminPreview: Boolean,
  connected: Boolean,
});
function formatDate(value) {
  return value
    ? new Date(
        value.includes("T") ? value : value.replace(" ", "T") + "Z",
      ).toLocaleDateString("ko-KR")
    : "—";
}
const emit = defineEmits(["navigate", "edit", "delete"]);
</script>

<template>
  <div class="page-toolbar">
    <button
      type="button"
      class="back-link"
      @click="emit('navigate', '#/songs')"
    >
      ← 목록으로 돌아가기</button
    ><span class="toolbar-trail">노래책자 / 상세</span>
  </div>
  <section class="detail-layout">
    <div class="detail-main">
      <div class="detail-top card">
        <CoverImage
          eager
          class="detail-cover"
          :src="song.cover || '/images/covers/night.svg'"
          :alt="`${song.title} 기본 커버`"
        />
        <div class="detail-title-area">
          <span class="eyebrow">SONG DETAILS</span>
          <h1>{{ song.title }}</h1>
          <p class="detail-artist">{{ song.artist }}</p>
          <div class="detail-chips">
            <span v-if="song.genre" class="genre-chip">{{ song.genre }}</span
            ><StatusPill :status="song.practiceStatus" />
          </div>
        </div>
      </div>
      <div class="detail-stats card">
        <div class="stat-row">
          <span class="stat-label">숙련도</span
          ><LeafRating :value="song.level" showNumber />
        </div>
        <div class="stat-row">
          <span class="stat-label">연습 상태</span
          ><StatusPill :status="song.practiceStatus" />
        </div>
        <div class="stat-row">
          <span class="stat-label">신청 풍 개수</span
          ><strong class="stat-count"
            >🍃
            {{ Number(song.balloonCount).toLocaleString("ko-KR") }}개</strong
          >
        </div>
      </div>
      <section class="card detail-section">
        <h2>곡 설명</h2>
        <p class="detail-description">
          {{ song.description || "등록된 설명이 없습니다." }}
        </p>
      </section>
      <section
        v-if="!connected || song.links?.length"
        class="card detail-section"
      >
        <h2>관련 링크</h2>
        <div v-if="song.links?.length" class="detail-links">
          <a
            v-for="(link, idx) in song.links"
            :key="idx"
            :href="link.url"
            rel="noopener noreferrer"
            target="_blank"
            class="detail-link"
            >↗ {{ link.label || "관련 링크" }}</a
          >
        </div>
        <p v-else class="muted">등록된 링크가 없어요.</p>
      </section>
    </div>
    <aside class="detail-side">
      <div class="card aside-card">
        <span class="eyebrow">ZIO'S SONGBOOK</span>
        <h2>지오의 노래 한 곡 ♡</h2>
        <img
          class="aside-zio"
          src="/images/themes/zio-cutout-v1.webp"
          alt="지오"
        />
        <p>좋은 노래를 함께 나눠요.<br />오늘도 지오와 즐거운 시간!</p>
      </div>
      <div class="card aside-card aside-info">
        <h3>등록 정보</h3>
        <div>
          <span>등록일</span><strong>{{ formatDate(song.createdAt) }}</strong>
        </div>
        <div>
          <span>수정일</span><strong>{{ formatDate(song.updatedAt) }}</strong>
        </div>
        <div>
          <span>언어</span><strong>{{ song.language || "미지정" }}</strong>
        </div>
      </div>
      <div v-if="adminPreview" class="aside-actions">
        <button class="btn btn-outline" type="button" @click="emit('edit')">
          ✎ 수정하기</button
        ><button
          class="btn btn-danger-ghost"
          type="button"
          @click="emit('delete')"
        >
          삭제
        </button>
      </div>
    </aside>
  </section>
</template>
