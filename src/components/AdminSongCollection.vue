<script setup>
import SongCard from "./SongCard.vue";
import SongManagementActions from "./SongManagementActions.vue";
import LeafRating from "./LeafRating.vue";
import StatusPill from "./StatusPill.vue";
import { toSongView } from "../services/song-adapter.js";
import { formatNumber } from "../services/song-labels.js";
import "../styles/song-management.css";
defineProps({
  items: { type: Array, required: true },
  busy: Boolean,
  list: Boolean,
});
defineEmits(["edit", "toggle", "delete"]);
</script>
<template>
  <div v-if="list" class="admin-song-table-wrap">
    <table class="admin-song-table">
      <caption class="sr-only">
        노래 관리 목록
      </caption>
      <thead>
        <tr>
          <th scope="col">곡명</th>
          <th scope="col">아티스트</th>
          <th scope="col">숙련도·연습 상태</th>
          <th scope="col">신청 풍</th>
          <th scope="col">공개</th>
          <th scope="col">관리</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="song in items" :key="song.id">
          <td>
            <button
              type="button"
              class="admin-song-title"
              :disabled="busy"
              :aria-label="song.title + ' 정보 수정'"
              @click="$emit('edit', song)"
            >
              {{ song.title }}</button
            ><small v-if="song.genre || song.language">{{
              [song.genre, song.language].filter(Boolean).join(" · ")
            }}</small>
          </td>
          <td>{{ song.artist }}</td>
          <td>
            <div class="admin-song-practice">
              <LeafRating :value="song.proficiency" show-number /><StatusPill
                :status="toSongView(song).practiceStatus"
              />
            </div>
          </td>
          <td class="admin-song-cost">
            {{ formatNumber(song.balloon_cost) }}개
          </td>
          <td>
            <span
              class="visibility-label"
              :class="{ 'is-private': !song.is_public }"
              >{{ song.is_public ? "공개" : "비공개" }}</span
            >
          </td>
          <td>
            <SongManagementActions
              :song="song"
              :busy="busy"
              @edit="$emit('edit', $event)"
              @toggle="$emit('toggle', $event)"
              @delete="$emit('delete', $event)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-else class="song-grid admin-song-grid">
    <article v-for="song in items" :key="song.id" class="managed-song">
      <SongCard :song="toSongView(song)" @open="$emit('edit', song)" />
      <SongManagementActions
        :song="song"
        :busy="busy"
        show-status
        @edit="$emit('edit', $event)"
        @toggle="$emit('toggle', $event)"
        @delete="$emit('delete', $event)"
      />
    </article>
  </div>
</template>
