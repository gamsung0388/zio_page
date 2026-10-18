<script setup>
defineProps({
  song: { type: Object, required: true },
  busy: Boolean,
  showStatus: Boolean,
});
defineEmits(["edit", "toggle", "delete"]);
</script>
<template>
  <div class="song-management-actions">
    <span
      v-if="showStatus"
      class="visibility-label"
      :class="{ 'is-private': !song.is_public }"
      >{{ song.is_public ? "공개" : "비공개" }}</span
    >
    <button
      type="button"
      :disabled="busy"
      :aria-label="song.title + ' 수정'"
      @click="$emit('edit', song)"
    >
      수정
    </button>
    <button
      type="button"
      :disabled="busy"
      :aria-label="
        song.title + (song.is_public ? ' 비공개로 전환' : ' 공개로 전환')
      "
      @click="$emit('toggle', song)"
    >
      {{ song.is_public ? "비공개로 전환" : "공개로 전환" }}
    </button>
    <button
      type="button"
      :disabled="busy"
      class="delete-song"
      :aria-label="song.title + ' 삭제'"
      @click="$emit('delete', song)"
    >
      삭제
    </button>
  </div>
</template>
