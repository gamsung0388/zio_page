<script setup>
import Icon from "../components/Icon.vue";
import GuideLink from "../components/guide/GuideLink.vue";
import { songGuideLink } from "../services/song-guide.js";
import { useRoute } from "vue-router";
import { computed } from "vue";
import { useSongs } from "../services/useSongs.js";
import { sortLabels, formatNumber } from "../services/song-labels.js";
import SongFilters from "../components/SongFilters.vue";
import SongCard from "../components/SongCard.vue";
import { toSongView } from "../services/song-adapter.js";
import Pagination from "../components/Pagination.vue";
import Notice from "../components/Notice.vue";
const route = useRoute();
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
} = useSongs();
const hasFilters = computed(() =>
  ["q", "proficiency", "practice_status", "genre", "language"].some(
    (k) => filters[k],
  ),
);
</script>
<template>
  <div class="container page songs-page">
    <div class="breadcrumb">
      <RouterLink to="/">홈</RouterLink><span>/</span>노래책자
    </div>
    <div class="page-heading song-heading">
      <div>
        <div class="eyebrow">ZIO'S SONGBOOK</div>
        <h1>지오의 노래책자<span class="green-period">.</span></h1>
        <p>지오의 노래들을 한곳에. 듣고 싶은 노래를 천천히 골라보세요.</p>
      </div>
      <GuideLink :to="songGuideLink(route.fullPath)" />
    </div>
    <SongFilters
      :filters="filters"
      :facets="facets"
      @update="update"
      @search="search"
      @reset="reset"
    />
    <div class="results-toolbar">
      <p role="status">
        총 <strong>{{ formatNumber(total) }}</strong
        >곡 <span v-if="hasFilters" class="muted">· 검색 결과</span>
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
        :error="error"
        :loading="loading"
        :empty="!items.length"
        :title="hasFilters ? '조건에 맞는 노래가 없어요' : undefined"
        :message="
          hasFilters ? '검색어를 바꾸거나 필터를 초기화해보세요.' : undefined
        "
        @retry="load"
        ><button v-if="hasFilters" class="text-button" @click="reset">
          필터 초기화
        </button></Notice
      >
      <div v-if="!loading && !error && items.length" class="song-grid">
        <SongCard
          v-for="song in items"
          :key="song.id"
          :song="toSongView(song)"
          :to="{
            path: '/songs/' + song.id,
            query: { returnTo: route.fullPath },
          }"
        />
      </div>
    </div>
    <Pagination
      :page="page"
      :pages="pages"
      :disabled="loading"
      @change="update('page', $event)"
    />
    <aside class="info-note">
      <Icon name="balloon" :size="20" />
      <p>
        풍 개수는 노래 신청에 필요한 수량 안내입니다. 실제 신청은 방송의 안내를
        따라주세요.
      </p>
    </aside>
  </div>
</template>
