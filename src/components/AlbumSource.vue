<script setup>
defineProps({ album: Object });
</script>
<template>
  <a
    v-if="album"
    class="album-source"
    :href="album.source_url"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="album.title + ' 공식 음원 보기 (새 탭)'"
  >
    <img
      src="/images/itunes-badge.svg"
      alt="Get it on iTunes Store"
      width="110"
      height="40"
      loading="lazy"
    />
    <span>{{ album.album_title }}<small>공식 음원 보기 ↗</small></span>
  </a>
</template>
