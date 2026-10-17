<script setup>
import Icon from "../Icon.vue";
defineProps({
  to: { type: [String, Object], required: true },
  label: { type: String, default: "사용 가이드" },
  newTab: Boolean,
});
</script>
<template>
  <RouterLink
    class="song-guide-link"
    :to="to"
    :target="newTab ? '_blank' : undefined"
    :rel="newTab ? 'noopener' : undefined"
  >
    <Icon name="book" :size="17" />{{ label }}
    <Icon v-if="newTab" name="external" :size="14" />
    <span v-if="newTab" class="sr-only">(새 탭)</span>
  </RouterLink>
</template>
<style scoped>
.song-guide-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid #d6e3cd;
  border-radius: 10px;
  background: #f2f7ed;
  color: #315433;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
}
.song-guide-link:hover {
  background: #e7f1de;
  border-color: #a9c892;
}
</style>
