<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { isDate, mondayOf } from "../../../shared/schedule/dates.js";
const route = useRoute();
const month = computed(() =>
  route.path !== "/admin/schedule/image" && isDate(route.query.month + "-01")
    ? route.query.month
    : isDate(route.query.week)
      ? route.query.week.slice(0, 7)
      : isDate(route.query.month + "-01")
        ? route.query.month
        : undefined,
);
const week = computed(() =>
  isDate(route.query.week)
    ? mondayOf(route.query.week)
    : month.value
      ? mondayOf(month.value + "-01")
      : undefined,
);
</script>
<template>
  <nav class="schedule-tabs" aria-label="일정 관리 메뉴">
    <RouterLink
      :to="{ path: '/admin/schedule', query: { month, week } }"
      :class="{ active: $route.path === '/admin/schedule' }"
      active-class=""
      exact-active-class=""
      >일정 달력</RouterLink
    ><RouterLink
      :to="{ path: '/admin/schedule/image', query: { week } }"
      :class="{ active: $route.path === '/admin/schedule/image' }"
      active-class=""
      exact-active-class=""
      >스케줄 이미지</RouterLink
    ><RouterLink
      :to="{ path: '/admin/schedule/notes', query: { month, week } }"
      :class="{ active: $route.path === '/admin/schedule/notes' }"
      active-class=""
      exact-active-class=""
      >주간 이미지 메모</RouterLink
    >
  </nav>
</template>
