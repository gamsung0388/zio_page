<script setup>
import { RouterLink } from "vue-router";
import CoverImage from "./CoverImage.vue";
import LeafRating from "./LeafRating.vue";
import StatusPill from "./StatusPill.vue";
defineProps({
  song: { type: Object, required: true },
  compact: Boolean,
  to: [String, Object],
});
const emit = defineEmits(["open"]);
</script>

<template>
  <component
    :is="to ? RouterLink : 'button'"
    :to="to"
    :aria-label="song.title"
    class="song-card"
    :class="{ 'song-card-compact': compact }"
    :type="to ? undefined : 'button'"
    @click="emit('open', song.id)"
  >
    <span class="song-card-art-wrap"
      ><CoverImage
        class="song-card-art"
        :src="song.cover || '/images/covers/night.svg'"
        :alt="`${song.title} 기본 커버`"
    /></span>
    <span class="song-card-main">
      <strong class="song-card-title">{{ song.title }}</strong>
      <span class="song-card-artist">{{ song.artist }}</span>
      <span class="song-card-tags"
        ><span v-if="song.genre" class="genre-chip">{{ song.genre }}</span
        ><StatusPill :status="song.practiceStatus"
      /></span>
      <span class="song-card-bottom"
        ><LeafRating :value="Number(song.level) || 0" /><span class="song-wind"
          >🍃 {{ Number(song.balloonCount).toLocaleString("ko-KR") }}개</span
        ></span
      >
    </span>
    <span class="song-card-arrow" aria-hidden="true">›</span>
  </component>
</template>
