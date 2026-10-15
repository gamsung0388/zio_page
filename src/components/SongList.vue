<script setup>
import Icon from "./Icon.vue";
import SongBadges from "./SongBadges.vue";
import { formatNumber } from "../services/song-labels.js";
defineProps({ songs: Array, admin: Boolean, busy: Boolean });
defineEmits(["edit", "delete", "toggle"]);
</script>
<template>
  <div class="song-table">
    <div class="song-table-head">
      <span>곡명 / 가수</span><span>숙련도</span><span>연습 상태</span
      ><span>필요 풍</span><span v-if="admin">관리</span><span v-else></span>
    </div>
    <article
      v-for="song in songs"
      :key="song.id"
      class="song-row"
      :class="{ 'admin-row': admin }"
    >
      <div class="song-title-cell">
        <span class="song-art" aria-hidden="true"
          ><Icon name="music" :size="23"
        /></span>
        <div>
          <button
            v-if="admin"
            class="song-title text-button"
            @click="$emit('edit', song)"
          >
            {{ song.title }}</button
          ><RouterLink v-else :to="`/songs/${song.id}`" class="song-title">{{
            song.title
          }}</RouterLink>
          <p class="artist">
            {{ song.artist }}
            <span v-if="admin && !song.is_public" class="private-label"
              >비공개</span
            >
          </p>
        </div>
      </div>
      <div class="song-badges"><SongBadges :song="song" /></div>
      <div class="balloon-cost">
        <Icon name="balloon" :size="16" /><strong>{{
          formatNumber(song.balloon_cost)
        }}</strong
        ><span>개</span>
      </div>
      <div v-if="admin" class="row-actions">
        <button
          class="small text-button"
          :disabled="busy"
          :aria-label="`${song.title} ${song.is_public ? '비공개로' : '공개로'} 전환`"
          @click="$emit('toggle', song)"
        >
          {{ song.is_public ? "공개" : "비공개" }}</button
        ><button
          class="icon-button"
          :disabled="busy"
          :aria-label="`${song.title} 수정`"
          @click="$emit('edit', song)"
        >
          <Icon name="edit" :size="17" /></button
        ><button
          class="icon-button danger"
          :disabled="busy"
          :aria-label="`${song.title} 삭제`"
          @click="$emit('delete', song)"
        >
          <Icon name="trash" :size="17" />
        </button>
      </div>
      <RouterLink
        v-else
        :to="`/songs/${song.id}`"
        class="row-link"
        :aria-label="`${song.title} 상세 보기`"
        ><Icon name="arrow" :size="18"
      /></RouterLink>
    </article>
  </div>
</template>
