<script setup>
defineProps({ pending: Object, error: String });
defineEmits(["restore", "discard"]);
</script>
<template>
  <div v-if="pending" class="draft-recovery" role="status">
    <p>
      이 계정으로 작성하던 초안이 있어요. 같은 탭에서 24시간 동안 보관됩니다.
    </p>
    <button type="button" class="btn btn-primary" @click="$emit('restore')">
      초안 복구
    </button>
    <button type="button" class="btn btn-outline" @click="$emit('discard')">
      초안 버리기
    </button>
  </div>
  <p v-if="error" class="form-error" role="alert">{{ error }}</p>
</template>
