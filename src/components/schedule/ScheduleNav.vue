<script setup>
import { computed } from "vue";
import { queryPage } from "../../../shared/pagination.js";
import { useRoute } from "vue-router";
import { isDate, mondayOf } from "../../../shared/schedule/dates.js";
import { EVENT_KINDS } from "../../../shared/schedule/events.js";
const route = useRoute();
const page = computed(() =>
  queryPage(route.query.page) > 1
    ? String(queryPage(route.query.page))
    : undefined,
);
const kind = computed(() =>
  EVENT_KINDS.some((item) => item.value === route.query.kind)
    ? route.query.kind
    : undefined,
);
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
const view = computed(() =>
  ["calendar", "list"].includes(route.query.view)
    ? route.query.view
    : undefined,
);
const day = computed(() =>
  isDate(route.query.day) ? route.query.day : undefined,
);
</script>
<template>
  <nav class="schedule-tabs" aria-label="일정 관리 메뉴">
    <RouterLink
      :to="{
        path: '/admin/schedule',
        query: { month, week, view, day, kind, page },
      }"
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
    ><RouterLink
      :to="{
        path: '/admin/schedule/guide',
        query: { month, week, view, day, kind, page },
      }"
      :class="{ active: $route.path === '/admin/schedule/guide' }"
      active-class=""
      exact-active-class=""
      >사용 가이드</RouterLink
    >
  </nav>
</template>
