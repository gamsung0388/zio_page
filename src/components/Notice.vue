<script setup>
defineProps({
  error: String,
  loading: Boolean,
  empty: Boolean,
  title: String,
  message: String,
});
defineEmits(["retry"]);
import Icon from "./Icon.vue";
</script>
<template>
  <div v-if="error" class="notice error-notice" role="alert">
    <Icon name="close" :size="28" />
    <h3>잠시 연결이 어려워요</h3>
    <p>{{ error }}</p>
    <button class="button secondary small" @click="$emit('retry')">
      다시 시도
    </button>
  </div>
  <div v-else-if="loading" class="notice" role="status">
    <span class="spinner"></span>
    <p>노래를 불러오고 있어요.</p>
  </div>
  <div v-else-if="empty" class="notice empty-notice">
    <span class="empty-icon"><Icon name="music" :size="28" /></span>
    <h3>{{ title || "아직 등록된 노래가 없어요" }}</h3>
    <p>{{ message || "노래책자를 채워가는 중이에요. 조금만 기다려주세요." }}</p>
    <slot />
  </div>
</template>
