<script setup>
defineProps({ label: { type: String, required: true } });
</script>
<template>
  <details class="reading-guide-details">
    <summary>{{ label }}</summary>
    <div><slot /></div>
  </details>
</template>
<style scoped>
.reading-guide-details {
  margin: 18px 0;
  border: 1px solid #e0e8d9;
  border-radius: 12px;
  background: #fbfcf8;
  overflow: hidden;
}
.reading-guide-details > summary {
  min-height: 48px;
  padding: 14px 18px;
  color: #284e32;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
.reading-guide-details[open] > summary {
  border-bottom: 1px solid #e0e8d9;
  background: #f1f6eb;
}
.reading-guide-details > div {
  padding: 4px 18px 16px;
  min-width: 0;
}
</style>
