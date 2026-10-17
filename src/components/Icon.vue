<script setup>
defineProps({ name: String, size: { default: 20 } });
const paths = {
  home: "m3 10 9-7 9 7v11H3V10Zm6 11v-7h6v7",
  calendar: "M4 5h16v16H4V5Zm3-3v6m10-6v6M4 11h16M8 15h2m4 0h2M8 18h2",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  layout: "M3 3h18v18H3V3Zm0 6h18M9 9v12",
  external: "M14 3h7v7m0-7L10 14M10 3H3v18h18v-7",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "M19 12H5m6-6-6 6 6 6",
  search: "m21 21-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z",
  music:
    "M9 18V5l12-3v13M9 8l12-3M9 18c0 1.7-1.8 3-4 3s-3-1-3-2.5S3.8 16 6 16s3 .5 3 2Zm12-3c0 1.7-1.8 3-4 3s-3-1-3-2.5 1.8-2.5 4-2.5 3 .5 3 2Z",
  book: "M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z",
  lock: "M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4V10Zm8 5v3",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
  edit: "m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  logout: "M9 3H3v18h6m5-15 6 6-6 6M8 12h12",
  check: "m4 12 5 5L20 6",
  leaf: "M20 3C8 1 1 7 5 16s18 6 15-13ZM4 21 16 9",
  filter: "M3 6h18M6 12h12M9 18h6",
  balloon:
    "M12 18c-5-2-7-6-7-10a7 7 0 0 1 14 0c0 4-2 8-7 10Zm0 0-2 3h4l-2-3Zm0 3v2",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.music" />
  </svg>
</template>
