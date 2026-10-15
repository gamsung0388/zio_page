<script setup>
import { ref, onMounted, onBeforeUnmount, useId } from "vue";
import Icon from "./Icon.vue";
defineProps({ title: String, busy: Boolean, wide: Boolean });
const emit = defineEmits(["close"]);
const dialog = ref();
const titleId = useId();
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value.showModal();
});
onBeforeUnmount(() => {
  dialog.value?.close();
  previousFocus?.focus();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="{ wide }"
    :aria-labelledby="titleId"
    @cancel.prevent="!busy && emit('close')"
    @click="(e) => e.target === dialog && !busy && emit('close')"
  >
    <div class="modal-heading">
      <h2 :id="titleId">{{ title }}</h2>
      <button
        class="icon-button"
        aria-label="닫기"
        :disabled="busy"
        @click="emit('close')"
      >
        <Icon name="close" />
      </button>
    </div>
    <slot />
  </dialog>
</template>
