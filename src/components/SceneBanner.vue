<script setup>
defineProps({
  title: { type: String, default: "좋은 노래로, 오늘도 함께" },
  description: {
    type: String,
    default: "지오의 작은 음악 공간에 오신 걸 환영해요.",
  },
});
</script>
<template>
  <div class="scene-banner">
    <div class="scene-banner-copy">
      <span>ZIO'S LITTLE MUSIC SPACE</span><strong>{{ title }}</strong>
      <p>{{ description }}</p>
    </div>
    <img
      src="/images/themes/zio-cutout-v1.webp"
      alt=""
      width="400"
      height="420"
    />
    <span class="scene-signature" aria-hidden="true">Zio ♡</span>
  </div>
</template>
