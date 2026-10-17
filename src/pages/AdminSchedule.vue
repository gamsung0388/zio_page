<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  useRoute,
  useRouter,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
} from "vue-router";
import {
  monthDates,
  shiftMonth,
  mondayOf,
  isDate,
} from "../../shared/schedule/dates.js";
import {
  EVENT_KINDS,
  isEventDate,
  eventOccursOn,
  eventTimeLabel,
  eventPeriodLabel,
  kstInstant,
} from "../../shared/schedule/events.js";
import {
  eventDateLabel,
  eventRangeLabel,
} from "../schedule/event-presentation.js";
import { useKstToday } from "../schedule/useKstToday.js";
import {
  fetchEvents,
  fetchAllEvents,
  backupEventsFile,
  readEventsFile,
} from "../schedule/events-service.js";
import { notify } from "../services/notifications.js";
import ScheduleNav from "../components/schedule/ScheduleNav.vue";
import ScheduleEventDialog from "../components/schedule/ScheduleEventDialog.vue";
import Modal from "../components/Modal.vue";
import Notice from "../components/Notice.vue";
const route = useRoute(),
  router = useRouter(),
  today = useKstToday(),
  initialToday = today.value,
  initialMonth = today.value.slice(0, 7),
  mobileView = window.matchMedia("(max-width:640px)").matches
    ? "list"
    : "calendar";
const month = computed(() =>
    isEventDate(route.query.month + "-01") ? route.query.month : initialMonth,
  ),
  dates = computed(() => monthDates(month.value)),
  kind = computed(() =>
    EVENT_KINDS.some((item) => item.value === route.query.kind)
      ? route.query.kind
      : "",
  ),
  view = computed(() =>
    ["list", "calendar"].includes(route.query.view)
      ? route.query.view
      : mobileView,
  );
const events = ref([]),
  loading = ref(true),
  error = ref(""),
  transfer = ref(false),
  actionError = ref(""),
  dialog = ref(null),
  importData = ref(null),
  importIndex = ref(0),
  pendingImport = ref(null);
const editId = computed(() =>
  typeof route.query.edit === "string" &&
  /^(?:new|[1-9]\d*)$/.test(route.query.edit)
    ? route.query.edit
    : "",
);
const initialDate = computed(() =>
  isEventDate(route.query.date) ? route.query.date : initialToday,
);
const inMonth = computed(() =>
  events.value.filter(
    (item) =>
      item.starts_at < kstInstant(shiftMonth(month.value, 1) + "-01") &&
      item.ends_at > kstInstant(month.value + "-01"),
  ),
);
const selectedDay = computed(() =>
  isEventDate(route.query.day) && dates.value.includes(route.query.day)
    ? route.query.day
    : "",
);
const newDate = computed(
  () =>
    selectedDay.value ||
    (today.value.startsWith(month.value) ? today.value : month.value + "-01"),
);
const listItems = computed(() =>
  selectedDay.value
    ? events.value.filter((item) => eventOccursOn(item, selectedDay.value))
    : inMonth.value,
);
const dayGroups = computed(() => {
  const groups = new Map();
  for (const event of listItems.value) {
    const date =
      selectedDay.value ||
      (event.start_date < month.value + "-01"
        ? month.value + "-01"
        : event.start_date);
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(event);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
});
const eventsByDay = computed(
  () =>
    new Map(
      dates.value.map((date) => [
        date,
        events.value.filter((item) => eventOccursOn(item, date)),
      ]),
    ),
);
const resultCount = computed(() =>
  selectedDay.value
    ? listItems.value.length + "개 일정 · 선택한 날짜"
    : inMonth.value.length + "개 일정 · 한국 시간",
);
let controller;
async function load() {
  controller?.abort();
  controller = new AbortController();
  const request = controller;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchEvents(dates.value[0], dates.value.at(-1), {
      kind: kind.value,
      signal: request.signal,
    });
    if (request === controller) events.value = data;
  } catch (err) {
    if (err.name !== "AbortError") error.value = err.message;
  } finally {
    if (request === controller) loading.value = false;
  }
}
watch(
  [month, kind],
  () => {
    load();
  },
  { immediate: true },
);
watch(editId, (value) => {
  if (!value) pendingImport.value = null;
});
function dayEvents(date) {
  return eventsByDay.value.get(date) || [];
}
function kindLabel(value) {
  return EVENT_KINDS.find((kind) => kind.value === value)?.label || "기타";
}
async function changeQuery(query, input, field) {
  try {
    const next = { ...route.query, ...query };
    if (Object.hasOwn(query, "month") || Object.hasOwn(query, "kind"))
      next.day = undefined;
    await router.push({ query: next });
  } finally {
    if (input) input.value = field === "month" ? month.value : kind.value;
  }
}
function open(id = "new", date = newDate.value) {
  router.push({
    query: {
      ...route.query,
      month: month.value,
      edit: String(id),
      date: id === "new" ? date : undefined,
    },
  });
}
function close() {
  router.replace({
    query: { ...route.query, edit: undefined, date: undefined },
  });
}
async function saved(event, image) {
  const resetKind = Boolean(kind.value && kind.value !== event.kind);
  const keepDay = !selectedDay.value || eventOccursOn(event, selectedDay.value);
  notify(
    resetKind
      ? "일정을 저장했습니다. 저장한 일정을 볼 수 있도록 전체 구분으로 바꿨어요."
      : "일정을 저장했습니다.",
  );
  if (image)
    await router.push({
      path: "/admin/schedule/image",
      query: { week: mondayOf(event.start_date), events: "1" },
    });
  else {
    const previousMonth = month.value;
    const overlaps =
      event.starts_at < kstInstant(shiftMonth(previousMonth, 1) + "-01") &&
      event.ends_at > kstInstant(previousMonth + "-01");
    await router.replace({
      query: {
        ...route.query,
        month: overlaps ? previousMonth : event.start_date.slice(0, 7),
        kind: resetKind ? undefined : route.query.kind,
        day: overlaps && keepDay ? route.query.day : undefined,
        edit: undefined,
        date: undefined,
      },
    });
    if (month.value === previousMonth && !resetKind) await load();
  }
}
async function deleted() {
  notify("선택한 일정을 삭제했습니다.");
  await router.replace({
    query: { ...route.query, edit: undefined, date: undefined },
  });
  await load();
}
function leave(to, from) {
  if (to.path === "/admin/login" || to.path === "/admin/password") return true;
  if (to.fullPath === from.fullPath) return true;
  if (transfer.value) return false;
  return !dialog.value || dialog.value.confirmLeave();
}
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(leave);
function more(date) {
  changeQuery({ view: "list", day: date });
}
async function backup(all) {
  if (transfer.value) return;
  transfer.value = true;
  actionError.value = "";
  try {
    backupEventsFile(
      all ? await fetchAllEvents() : inMonth.value,
      all ? "zio-events-all-" + today.value : "zio-events-" + month.value,
    );
    notify("개별 일정 백업을 만들었습니다.");
  } catch (err) {
    actionError.value = err.message;
  } finally {
    transfer.value = false;
  }
}
async function importFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || transfer.value) return;
  actionError.value = "";
  try {
    const data = await readEventsFile(file);
    if (!data.events.length) throw new Error("백업에 일정이 없습니다.");
    importData.value = data;
    importIndex.value = 0;
  } catch (err) {
    actionError.value = err.message;
  }
}
async function applyImport() {
  const value = importData.value.events[importIndex.value];
  pendingImport.value = value;
  importData.value = null;
  await router.push({
    query: { ...route.query, edit: "new", date: value.start_date },
  });
}
function beforeUnload(event) {
  if (transfer.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => {
  controller?.abort();
  window.removeEventListener("beforeunload", beforeUnload);
});
</script>
<template>
  <div class="schedule-page event-calendar-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">ZIO SCHEDULE</span>
        <h1>방송 일정 달력 <span class="heading-sprout">✿</span></h1>
        <p>
          일정마다 기간과 시간을 정하고, 같은 날 여러 일정도 따로 관리하세요.
        </p>
      </div>
      <button class="btn btn-primary" :disabled="transfer" @click="open()">
        새 일정 등록
      </button>
    </div>
    <ScheduleNav />
    <section class="card calendar-panel" :aria-busy="loading">
      <div class="calendar-toolbar">
        <h2>{{ month.replace("-", "년 ") }}월</h2>
        <div>
          <button
            class="btn btn-outline"
            aria-label="이전 달"
            :disabled="month === '2000-01'"
            @click="changeQuery({ month: shiftMonth(month, -1) })"
          >
            ←</button
          ><label
            ><span class="sr-only">표시할 월</span
            ><input
              type="month"
              :value="month"
              min="2000-01"
              max="2099-12"
              @change="
                changeQuery(
                  { month: $event.target.value },
                  $event.target,
                  'month',
                )
              " /></label
          ><button
            class="btn btn-outline"
            aria-label="다음 달"
            :disabled="month === '2099-12'"
            @click="changeQuery({ month: shiftMonth(month, 1) })"
          >
            →</button
          ><button
            class="btn btn-outline"
            @click="changeQuery({ month: today.slice(0, 7) })"
          >
            이번 달
          </button>
        </div>
      </div>
      <div class="event-view-toolbar">
        <div class="event-view-switch" role="group" aria-label="일정 보기 방식">
          <button
            class="btn btn-outline"
            :aria-pressed="view === 'calendar'"
            @click="changeQuery({ view: 'calendar', day: undefined })"
          >
            달력 보기</button
          ><button
            class="btn btn-outline"
            :aria-pressed="view === 'list'"
            @click="changeQuery({ view: 'list' })"
          >
            일정 목록
          </button>
        </div>
        <label class="event-kind-filter"
          >일정 구분<select
            :value="kind"
            aria-label="일정 구분"
            @change="
              changeQuery(
                { kind: $event.target.value || undefined },
                $event.target,
                'kind',
              )
            "
          >
            <option value="">전체 일정</option>
            <option
              v-for="item in EVENT_KINDS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select></label
        ><button
          v-if="kind"
          class="text-button event-filter-clear"
          @click="changeQuery({ kind: undefined })"
        >
          구분 해제
        </button>
        <span role="status" aria-live="polite">{{
          loading ? "일정을 불러오는 중…" : resultCount
        }}</span>
      </div>
      <Notice
        :loading="loading"
        :error="error"
        loading-message="일정을 불러오고 있어요."
        @retry="load"
      />
      <template v-if="!loading && !error"
        ><div
          v-if="view === 'calendar'"
          class="calendar-grid event-calendar-grid"
          aria-label="방송 일정 달력"
        >
          <div
            v-for="day in ['월', '화', '수', '목', '금', '토', '일']"
            :key="day"
            class="calendar-weekday"
            :class="{ 'is-weekend': day === '토' || day === '일' }"
          >
            {{ day }}
          </div>
          <article
            v-for="date in dates"
            :key="date"
            class="event-calendar-day"
            :class="{
              'other-month': !date.startsWith(month),
              'is-today': date === today,
              'is-weekend': [0, 6].includes(
                new Date(date + 'T00:00:00Z').getUTCDay(),
              ),
            }"
          >
            <button
              class="event-date-add"
              :aria-label="date + ' 새 일정'"
              :aria-current="date === today ? 'date' : undefined"
              :disabled="!isEventDate(date)"
              @click="open('new', date)"
            >
              <span>{{ Number(date.slice(-2)) }}</span
              ><small v-if="date === today">오늘</small
              ><span aria-hidden="true">＋</span></button
            ><button
              v-for="event in dayEvents(date).slice(0, 3)"
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
              @click="open(event.id)"
            >
              <small>{{ eventTimeLabel(event, date) }}</small
              ><strong>{{ event.title }}</strong
              ><span
                v-if="event.start_date !== event.end_date"
                class="event-span-label"
                >기간 일정</span
              ></button
            ><button
              v-if="dayEvents(date).length > 3"
              class="event-more"
              @click="more(date)"
            >
              ＋{{ dayEvents(date).length - 3 }}개 더 보기
            </button>
          </article>
        </div>
        <div v-else class="schedule-event-list" aria-label="개별 일정 목록">
          <div v-if="selectedDay" class="event-day-filter">
            <strong>{{ eventDateLabel(selectedDay) }} 일정</strong>
            <button
              class="text-button"
              @click="changeQuery({ day: undefined })"
            >
              월 전체 보기
            </button>
          </div>
          <div v-if="!listItems.length" class="schedule-event-empty">
            <h3>
              {{
                kind
                  ? kindLabel(kind) + " 일정이 없어요"
                  : "등록된 일정이 없어요"
              }}
            </h3>
            <p>
              {{
                selectedDay
                  ? eventDateLabel(selectedDay)
                  : month.replace("-", "년 ") + "월"
              }}에 필요한 일정을 추가해보세요.
            </p>
            <button class="btn btn-primary" @click="open()">
              이 날짜에 일정 등록
            </button>
            <button
              v-if="kind"
              class="text-button"
              @click="changeQuery({ kind: undefined })"
            >
              전체 구분 보기
            </button>
          </div>
          <section
            v-for="group in dayGroups"
            :key="group.date"
            class="event-date-group"
            :aria-label="eventDateLabel(group.date) + ' 일정'"
          >
            <div class="event-group-heading">
              <h3>
                <time :datetime="group.date">{{
                  eventDateLabel(group.date)
                }}</time
                ><small v-if="group.date === today">오늘</small>
              </h3>
              <span>{{ group.items.length }}개</span>
            </div>
            <article
              v-for="event in group.items"
              :key="event.id"
              class="schedule-event-card"
            >
              <div>
                <div class="event-card-labels">
                  <span
                    class="event-kind-badge"
                    :class="'event-kind-' + event.kind"
                    >{{ kindLabel(event.kind) }}</span
                  ><span
                    v-if="event.start_date < group.date"
                    class="event-continuing"
                    >이전 날짜부터 이어지는 일정</span
                  >
                </div>
                <h4>{{ event.title }}</h4>
                <p class="event-readable-period">
                  {{ eventRangeLabel(event) }}
                </p>
                <p v-if="event.description" class="event-description">
                  {{ event.description }}
                </p>
              </div>
              <button
                class="btn btn-outline"
                :aria-label="event.title + ' 일정 수정'"
                @click="open(event.id)"
              >
                수정
              </button>
            </article>
          </section>
        </div></template
      >
    </section>
    <p class="schedule-help">
      모든 관리자가 함께 쓰는 관리자 전용 일정입니다. 기간 일정은 해당 날짜마다
      표시되며, 자정에 끝나는 일정은 다음 날에 표시되지 않습니다.
      <RouterLink to="/admin/schedule/notes"
        >기존 날짜별 메모는 주간 이미지 메모에서 확인하세요.</RouterLink
      >
    </p>
    <details class="card event-backup-tools">
      <summary>일정 백업과 가져오기</summary>
      <div>
        <button
          class="btn btn-outline"
          :disabled="transfer || loading || Boolean(error)"
          @click="backup(false)"
        >
          이번 달 일정 백업</button
        ><button
          class="btn btn-outline"
          :disabled="transfer"
          @click="backup(true)"
        >
          전체 일정 백업</button
        ><label class="btn btn-outline backup-upload"
          >백업에서 새 일정 입력<input
            type="file"
            aria-label="개별 일정 백업 파일"
            accept=".json,application/json"
            :disabled="transfer"
            @change="importFile"
        /></label>
      </div>
      <p class="schedule-help">
        이번 달 백업에는 현재 일정 구분 필터가 반영됩니다. 가져올 일정을 고른 뒤
        새 일정으로 직접 저장합니다. 주간 이미지 메모의 백업과 별도 형식입니다.
      </p>
    </details>
    <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
    <ScheduleEventDialog
      v-if="editId"
      :key="editId + ':' + initialDate"
      ref="dialog"
      :event-id="editId"
      :date="initialDate"
      :initial="pendingImport"
      :default-kind="kind || 'broadcast'"
      @close="close"
      @saved="saved"
      @deleted="deleted"
    /><Modal
      v-if="importData"
      title="개별 일정 백업 가져오기"
      @close="importData = null"
      ><label class="field"
        >가져올 일정<select v-model.number="importIndex">
          <option
            v-for="(event, index) in importData.events"
            :key="index"
            :value="index"
          >
            {{ event.title }} · {{ event.start_date }} ~ {{ event.end_date }}
          </option>
        </select></label
      >
      <p>선택한 일정이 입력창에 채워집니다. 내용을 확인하고 저장하세요.</p>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="importData = null">취소</button
        ><button class="btn btn-primary" @click="applyImport">
          새 일정으로 입력
        </button>
      </div></Modal
    >
  </div>
</template>
