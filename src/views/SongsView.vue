<script setup>
import { computed, ref } from "vue";
import { genres } from "../data/mockSongs";
import SongCard from "../components/SongCard.vue";
const props = defineProps({
  songs: { type: Array, default: () => [] },
  adminPreview: Boolean,
});
const emit = defineEmits(["open", "add"]);
const query = ref("");
const genre = ref("전체");
const sort = ref("recent");
const filtered = computed(() => {
  const q = query.value.trim().toLocaleLowerCase();
  const result = props.songs.filter(
    (song) =>
      (genre.value === "전체" || song.genre === genre.value) &&
      `${song.title} ${song.artist}`.toLocaleLowerCase().includes(q),
  );
  return [...result].sort((a, b) =>
    sort.value === "title"
      ? a.title.localeCompare(b.title, "ko")
      : b.createdAt.localeCompare(a.createdAt),
  );
});
</script>

<template>
  <section class="page-intro songbook-intro">
    <div>
      <span class="eyebrow">ZIO SONGBOOK</span>
      <h1>
        {{ adminPreview ? "노래 관리" : "노래책자" }}
        <span class="heading-sprout">✿</span>
      </h1>
      <p>
        지오의 노래 목록을 찾아보세요. <strong>총 {{ songs.length }}곡</strong>
      </p>
    </div>
    <button
      v-if="adminPreview"
      class="btn btn-primary"
      type="button"
      @click="emit('add')"
    >
      ＋ 곡 등록하기
    </button>
  </section>
  <section class="songbook-panel">
    <div class="filter-topline">
      <label class="searchbox"
        ><span aria-hidden="true">⌕</span
        ><input
          v-model="query"
          type="search"
          placeholder="곡명이나 아티스트로 검색하세요"
          aria-label="곡명 또는 아티스트 검색" /></label
      ><label class="sort-label"
        ><span class="sr-only">정렬</span
        ><select v-model="sort">
          <option value="recent">최신순</option>
          <option value="title">이름순</option>
        </select></label
      >
    </div>
    <div class="genre-tabs" aria-label="장르 선택">
      <button
        v-for="item in genres"
        :key="item"
        type="button"
        class="genre-tab"
        :class="{ active: genre === item }"
        :aria-pressed="genre === item"
        @click="genre = item"
      >
        {{ item }}
      </button>
    </div>
    <div class="song-results-caption">
      검색 결과 <strong>{{ filtered.length }}</strong
      >곡
    </div>
    <div v-if="filtered.length" class="song-grid">
      <SongCard
        v-for="song in filtered"
        :key="song.id"
        :song="song"
        @open="emit('open', $event)"
      />
    </div>
    <div v-else class="empty-state">
      <span>♫</span>
      <h3>검색 결과가 없어요</h3>
      <p>곡명이나 장르를 바꿔서 다시 찾아보세요.</p>
      <button
        class="btn btn-outline"
        type="button"
        @click="
          query = '';
          genre = '전체';
        "
      >
        필터 초기화
      </button>
    </div>
  </section>
</template>
