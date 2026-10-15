<script setup>
defineProps({ page: Number, pages: Number, disabled: Boolean });
defineEmits(["change"]);
</script>
<template>
  <nav class="pagination" aria-label="노래 목록 페이지">
    <button
      class="button secondary small"
      :disabled="page <= 1 || disabled"
      @click="$emit('change', page - 1)"
    >
      이전</button
    ><span aria-live="polite"
      ><strong>{{ page }}</strong> / {{ pages }} 페이지</span
    ><button
      class="button secondary small"
      :disabled="page >= pages || disabled"
      @click="$emit('change', page + 1)"
    >
      다음
    </button>
  </nav>
</template>
