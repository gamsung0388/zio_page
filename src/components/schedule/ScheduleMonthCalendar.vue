<script setup>
import "../../styles/event-calendar.css";
import { computed } from "vue";
import { buildCalendarWeeks } from "../../../shared/schedule/event-calendar.js";
import {
  EVENT_KINDS,
  isEventDate,
  eventTimeLabel,
} from "../../../shared/schedule/events.js";
import { eventRangeLabel } from "../../schedule/event-presentation.js";
const props = defineProps({
  events: Array,
  dates: Array,
  month: String,
  today: String,
});
const emit = defineEmits(["create", "edit", "more"]);
const weeks = computed(() => buildCalendarWeeks(props.events, props.dates));
function kindLabel(value) {
  return EVENT_KINDS.find((item) => item.value === value)?.label || "기타";
}
function segmentTime(segment) {
  const event = segment.event;
  if (event.time_mode !== "timed")
    return event.time_mode === "all_day" ? "종일" : "시간 미정";
  const end = event.end_time === "00:00" ? "다음날 00:00" : event.end_time;
  if (!segment.continuesBefore && !segment.continuesAfter)
    return event.start_time + "부터 · " + end + "까지";
  if (!segment.continuesBefore) return event.start_time + "부터";
  if (!segment.continuesAfter) return end + "까지";
  return "계속되는 일정";
}
</script>
<template>
  <p class="calendar-range-hint">
    기간 일정은 한 줄로 이어져요. 주가 바뀌면 다음 줄에서 계속됩니다.
  </p>
  <div class="calendar-grid event-calendar-grid" aria-label="방송 일정 달력">
    <div
      v-for="day in ['월', '화', '수', '목', '금', '토', '일']"
      :key="day"
      class="calendar-weekday"
      :class="{ 'is-weekend': day === '토' || day === '일' }"
    >
      {{ day }}
    </div>
    <div
      v-for="week in weeks"
      :key="week.start"
      class="event-calendar-week"
      :data-week="week.start"
      :style="{ '--period-rows': week.lanes }"
    >
      <article
        v-for="(day, index) in week.days"
        :key="day.date"
        class="event-calendar-day"
        :class="{
          'other-month': !day.date.startsWith(month),
          'is-today': day.date === today,
          'is-weekend': index >= 5,
        }"
      >
        <button
          class="event-date-add"
          :aria-label="day.date + ' 새 일정'"
          :aria-current="day.date === today ? 'date' : undefined"
          :disabled="!isEventDate(day.date)"
          @click="emit('create', day.date)"
        >
          <span>{{ Number(day.date.slice(-2)) }}</span
          ><small v-if="day.date === today">오늘</small
          ><span aria-hidden="true">＋</span>
        </button>
        <button
          v-for="event in day.items"
          :key="event.id"
          class="event-chip"
          :class="'event-kind-' + event.kind"
          :aria-label="event.title + ' 일정 수정'"
          :title="
            event.title +
            ' · ' +
            kindLabel(event.kind) +
            ' · ' +
            eventRangeLabel(event)
          "
          @click="emit('edit', event.id)"
        >
          <small>{{ eventTimeLabel(event, day.date) }}</small
          ><strong>{{ event.title }}</strong>
        </button>
        <button
          v-if="day.hidden"
          class="event-more"
          @click="emit('more', day.date)"
        >
          ＋{{ day.hidden }}개 더 보기
        </button>
      </article>
      <div v-if="week.lanes" class="event-period-layer">
        <button
          v-for="segment in week.segments"
          :key="segment.event.id"
          class="event-chip event-period-bar"
          :class="[
            'event-kind-' + segment.event.kind,
            {
              'continues-before': segment.continuesBefore,
              'continues-after': segment.continuesAfter,
            },
          ]"
          :style="{
            gridColumn: segment.column + ' / span ' + segment.span,
            gridRow: segment.lane + 1,
          }"
          :data-event-id="segment.event.id"
          :data-start="segment.start"
          :data-end="segment.end"
          :aria-label="segment.event.title + ' 일정 수정'"
          :aria-description="eventRangeLabel(segment.event)"
          :title="
            segment.event.title +
            ' · ' +
            kindLabel(segment.event.kind) +
            ' · ' +
            eventRangeLabel(segment.event)
          "
          @click="emit('edit', segment.event.id)"
        >
          <span
            v-if="segment.continuesBefore"
            class="period-continuation"
            aria-hidden="true"
            >‹</span
          ><strong>{{ segment.event.title }}</strong
          ><small>{{ segmentTime(segment) }}</small
          ><span
            v-if="segment.continuesAfter"
            class="period-continuation period-next"
            aria-hidden="true"
            >›</span
          >
        </button>
      </div>
    </div>
  </div>
</template>
