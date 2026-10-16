<script setup>
import { computed, ref, watch } from "vue";
const props = defineProps({
  src: { type: String, default: "" },
  alt: { type: String, default: "노래 기본 커버" },
  eager: Boolean,
});
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
function failedImage(event) {
  failed.value = true;
  if (event.target.getAttribute("src") !== "/images/covers/night.svg")
    event.target.src = "/images/covers/night.svg";
}
const source = computed(() =>
  !failed.value && props.src ? props.src : "/images/covers/night.svg",
);
</script>
<template>
  <img
    :src="source"
    :alt="alt"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    width="300"
    height="300"
    @error="failedImage"
  />
</template>
