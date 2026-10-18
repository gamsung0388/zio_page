<script setup>
import Modal from "./Modal.vue";
defineProps({
  title: { type: String, required: true },
  confirmLabel: { type: String, default: "삭제하기" },
  busy: Boolean,
  blocked: Boolean,
  error: String,
});
const emit = defineEmits(["close", "confirm"]);
</script>
<template>
  <Modal
    :title="title"
    :busy="busy"
    class="delete-confirmation"
    @close="emit('close')"
  >
    <div class="modal-intro"><slot /></div>
    <slot name="before-actions" />
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="modal-actions">
      <button
        type="button"
        class="button secondary"
        :disabled="busy"
        @click="emit('close')"
      >
        취소
      </button>
      <button
        type="button"
        class="button destructive"
        :disabled="busy || blocked"
        @click="emit('confirm')"
      >
        {{ busy ? "삭제 중…" : confirmLabel }}
      </button>
    </div>
  </Modal>
</template>
