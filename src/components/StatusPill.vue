<script setup>
defineProps({ status: { type: String, default: "미연습" } });
</script>

<template>
  <span class="status-pill" :class="`status-${status}`">{{ status }}</span>
</template>
