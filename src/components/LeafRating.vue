<script setup>
defineProps({
  value: { type: Number, default: 0 },
  editable: Boolean,
  showNumber: Boolean,
});
const emit = defineEmits(["change"]);
</script>

<template>
  <span
    class="leaf-rating"
    :class="{ 'is-editable': editable }"
    :aria-label="`숙련도 ${value}/5`"
  >
    <component
      :is="editable ? 'button' : 'span'"
      v-for="i in 5"
      :key="i"
      :type="editable ? 'button' : undefined"
      class="leaf-rating-item"
      :class="{ 'is-filled': i <= value }"
      :aria-label="editable ? `숙련도 ${i}단계 선택` : undefined"
      :aria-pressed="editable ? value === i : undefined"
      @click="editable && emit('change', i)"
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        fill="currentColor"
      >
        <path
          d="M21 3c-6.4.2-12.2 1.9-15.7 5.6C2.5 11.6 3.3 16 6.7 18c2.9 1.7 6.6.7 8.8-1.4C19.5 12.7 20.6 7.7 21 3ZM3 21c2.7-5.2 7.8-9.4 13-12.3"
        />
      </svg>
    </component>
    <span v-if="showNumber" class="rating-count">{{ value }} / 5</span>
  </span>
</template>
