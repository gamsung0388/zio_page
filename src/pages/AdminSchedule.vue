<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  useRoute,
  useRouter,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
} from "vue-router";
import DraftRecovery from "../components/DraftRecovery.vue";
import { useEditorDraft } from "../services/useEditorDraft.js";
import { useEditorGuard } from "../services/editor-guards.js";
import { useKstToday } from "../schedule/useKstToday.js";
import { api } from "../services/api.js";
import { notify } from "../services/notifications.js";
import {
  monthDates,
  shiftMonth,
  mondayOf,
  addDays,
  isDate,
} from "../../shared/schedule/dates.js";
import { schedulePayload } from "../../shared/schedule/validation.js";
import { DAY_OPTIONS } from "../../shared/schedule/scheduleConfig.js";
import Notice from "../components/Notice.vue";
import Modal from "../components/Modal.vue";
import ScheduleNav from "../components/schedule/ScheduleNav.vue";
const route = useRoute(),
  router = useRouter(),
  today = useKstToday();
const initialMonth = today.value.slice(0, 7);
const month = computed(() =>
  typeof route.query.month === "string" && isDate(route.query.month + "-01")
    ? route.query.month
    : initialMonth,
);
const dates = computed(() => monthDates(month.value)),
  monthTitle = computed(() => month.value.replace("-", "년 ") + "월");
const loading = ref(true),
  error = ref(""),
  weeks = ref([]),
  selected = ref(""),
  week = ref(null),
  dayLoading = ref(false),
  busy = ref(false),
  dayError = ref(""),
  draft = ref({ content: "", time: "" }),
  original = ref("");
let controller, dayController;
const dayKey = computed(
  () =>
    DAY_OPTIONS[(new Date(selected.value + "T00:00:00Z").getUTCDay() + 6) % 7]
      ?.key,
);
const dirty = computed(
  () =>
    Boolean(selected.value) && JSON.stringify(draft.value) !== original.value,
);
const drafts = useEditorDraft({
  scope: computed(() => (selected.value ? "day:" + selected.value : "")),
  ready: computed(() => Boolean(week.value) && !dayLoading.value),
  dirty,
  snapshot: () => ({ draft: { ...draft.value }, week: week.value }),
  validate(value) {
    try {
      schedulePayload(value.week);
      return (
        typeof value.draft?.content === "string" &&
        Array.from(value.draft.content).length <= 500 &&
        typeof value.draft?.time === "string" &&
        Array.from(value.draft.time).length <= 40 &&
        value.week.week_start === mondayOf(selected.value) &&
        Number.isSafeInteger(value.week.revision) &&
        value.week.revision >= 0
      );
    } catch {
      return false;
    }
  },
  apply(value) {
    draft.value = { ...value.draft };
    week.value = value.week;
  },
});
const { pending, storageError } = drafts;
useEditorGuard(() => dirty.value || busy.value);
function entry(date) {
  const source = weeks.value.find((item) => item.week_start === mondayOf(date));
  const index = (new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7;
  return source?.scheduleForm[DAY_OPTIONS[index].key];
}
async function load() {
  controller?.abort();
  controller = new AbortController();
  const request = controller;
  loading.value = true;
  error.value = "";
  try {
    weeks.value = (
      await api(
        "/admin/schedules?" +
          new URLSearchParams({ from: dates.value[0], to: dates.value.at(-1) }),
        { signal: request.signal },
      )
    ).items;
  } catch (err) {
    if (err.name !== "AbortError") error.value = err.message;
  } finally {
    if (request === controller) loading.value = false;
  }
}
watch(
  month,
  async () => {
    selected.value = "";
    dayController?.abort();
    await load();
    if (isDate(route.query.day)) open(route.query.day);
  },
  { immediate: true },
);
async function open(date) {
  dayController?.abort();
  dayController = new AbortController();
  const request = dayController;
  selected.value = date;
  router.replace({ query: { ...route.query, day: date } });
  week.value = null;
  dayError.value = "";
  dayLoading.value = true;
  draft.value = { content: "", time: "" };
  original.value = JSON.stringify(draft.value);
  try {
    const data = await api("/admin/schedules/" + mondayOf(date), {
      signal: request.signal,
    });
    if (selected.value !== date) return;
    week.value = data;
    draft.value = { ...data.scheduleForm[dayKey.value] };
    original.value = JSON.stringify(draft.value);
  } catch (err) {
    if (err.name !== "AbortError") dayError.value = err.message;
  } finally {
    if (request === dayController) dayLoading.value = false;
  }
}
function close() {
  if (busy.value) return;
  if (dirty.value && !window.confirm("저장하지 않은 내용을 닫을까요?")) return;
  drafts.clear();
  dayController?.abort();
  selected.value = "";
  router.replace({ query: { ...route.query, day: undefined } });
}
async function save(image = false, clear = false) {
  if (busy.value || !week.value) return;
  if (clear && !window.confirm("이 날짜의 내용을 비울까요?")) return;
  busy.value = true;
  dayError.value = "";
  const value = week.value,
    form = JSON.parse(JSON.stringify(value.scheduleForm));
  form[dayKey.value] = clear ? { content: "", time: "" } : { ...draft.value };
  try {
    await api("/admin/schedules/" + value.week_start, {
      method: "PUT",
      body: {
        selectedTemplate: value.selectedTemplate,
        editorOptions: value.editorOptions,
        scheduleForm: form,
        expected_revision: value.revision,
      },
    });
    original.value = JSON.stringify(draft.value);
    drafts.clear();
    selected.value = "";
    await router.replace({ query: { ...route.query, day: undefined } });
    notify(clear ? "이 날짜의 일정을 비웠습니다." : "일정을 저장했습니다.");
    if (image)
      await router.push({
        path: "/admin/schedule/image",
        query: { week: value.week_start },
      });
    else await load();
  } catch (err) {
    dayError.value = err.message;
  } finally {
    busy.value = false;
  }
}
function retryDay() {
  if (!dirty.value || window.confirm("입력 내용을 버리고 다시 불러올까요?"))
    open(selected.value);
}
async function changeMonth(value, input) {
  try {
    if (!busy.value) await router.push({ query: { month: value } });
  } finally {
    if (input) input.value = month.value;
  }
}
function leave(to, from) {
  if (to.path === from.path && to.query.month === from.query.month) return true;
  if (to.path === "/admin/login" || to.path === "/admin/password") return true;
  if (
    (busy.value && selected.value) ||
    (dirty.value && !window.confirm("저장하지 않은 일정을 두고 이동할까요?"))
  )
    return false;
  drafts.clear();
  return true;
}
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(leave);
function beforeUnload(event) {
  if (dirty.value || busy.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => {
  controller?.abort();
  dayController?.abort();
  window.removeEventListener("beforeunload", beforeUnload);
});
</script>
<template>
  <div class="schedule-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">ZIO SCHEDULE</span>
        <h1>방송 일정 달력 <span class="heading-sprout">✿</span></h1>
        <p>
          날짜를 눌러 내용과 시간을 입력하세요. 저장한 일정으로 주간 이미지를
          만들 수 있어요.
        </p>
      </div>
      <RouterLink
        class="btn btn-primary"
        :to="{
          path: '/admin/schedule/image',
          query: { week: mondayOf(today) },
        }"
        >이번 주 이미지 만들기</RouterLink
      >
    </div>
    <ScheduleNav />
    <section class="card calendar-panel">
      <div class="calendar-toolbar">
        <h2>{{ monthTitle }}</h2>
        <div>
          <button
            class="btn btn-outline"
            aria-label="이전 달"
            @click="changeMonth(shiftMonth(month, -1))"
          >
            ←</button
          ><label
            ><span class="sr-only">표시할 월</span
            ><input
              type="month"
              :value="month"
              @change="
                isDate($event.target.value + '-01') &&
                changeMonth($event.target.value, $event.target)
              " /></label
          ><button
            class="btn btn-outline"
            aria-label="다음 달"
            @click="changeMonth(shiftMonth(month, 1))"
          >
            →</button
          ><button
            class="btn btn-outline"
            @click="changeMonth(today.slice(0, 7))"
          >
            이번 달
          </button>
        </div>
      </div>
      <Notice :loading="loading" :error="error" @retry="load" />
      <div
        v-if="!loading && !error"
        class="calendar-grid"
        aria-label="방송 일정 달력"
      >
        <div v-for="day in DAY_OPTIONS" :key="day.key" class="calendar-weekday">
          {{ day.label }}
        </div>
        <button
          v-for="date in dates"
          :key="date"
          class="calendar-day"
          :class="{
            'other-month': !date.startsWith(month),
            'is-today': date === today,
            'has-schedule': entry(date)?.content || entry(date)?.time,
          }"
          :aria-label="date + ' 일정 편집'"
          @click="open(date)"
        >
          <span class="calendar-date"
            >{{ Number(date.slice(-2))
            }}<small v-if="date === today">오늘</small></span
          ><span
            class="calendar-entry"
            v-if="entry(date)?.content || entry(date)?.time"
            ><strong>{{ entry(date)?.time }}</strong
            ><span>{{ entry(date)?.content }}</span></span
          ><span v-else class="calendar-empty" aria-hidden="true">＋</span>
        </button>
      </div>
    </section>
    <p class="schedule-help">
      한국 날짜(Asia/Seoul) 기준 · 날짜별 내용과 시간 안내를 저장합니다.
      관리자에게만 표시됩니다.
    </p>
    <Modal
      v-if="selected"
      :title="selected + ' 일정'"
      :busy="busy"
      @close="close"
      ><Notice :loading="dayLoading" @retry="open(selected)" />
      <p v-if="dayError" class="form-error" role="alert">{{ dayError }}</p>
      <form v-if="week && !dayLoading" @submit.prevent="save()">
        <DraftRecovery
          :pending="pending"
          :error="storageError"
          @restore="drafts.restore"
          @discard="drafts.clear"
        />
        <fieldset class="editor-fields" :disabled="busy">
          <label class="field"
            >방송 내용<textarea
              v-model="draft.content"
              rows="4"
              maxlength="500"
              placeholder="예: 노래 방송 / 휴방 / 특별 방송"
            /></label
          ><label class="field"
            >시간 안내<input
              v-model="draft.time"
              maxlength="40"
              placeholder="예: 20:00 / 미정 / 휴방"
          /></label>
        </fieldset>
        <div class="schedule-quick-actions">
          <button
            type="button"
            class="btn btn-outline"
            :disabled="busy"
            @click="
              draft.content = '휴방';
              draft.time = '';
            "
          >
            휴방 입력</button
          ><button
            type="button"
            class="btn btn-outline"
            :disabled="busy"
            @click="draft.time = '미정'"
          >
            시간 미정
          </button>
        </div>
        <div class="calendar-dialog-actions">
          <button
            type="button"
            class="text-button"
            :disabled="busy"
            @click="save(false, true)"
          >
            이 날짜 일정 비우기</button
          ><button
            type="button"
            class="btn btn-outline"
            :disabled="busy"
            @click="save(true)"
          >
            저장하고 이미지 만들기
          </button>
        </div>
        <div class="modal-actions">
          <button
            type="button"
            class="button secondary"
            :disabled="busy"
            @click="close"
          >
            취소</button
          ><button class="button primary" :disabled="busy">
            {{ busy ? "저장 중…" : "일정 저장" }}
          </button>
        </div>
      </form>
      <button
        v-if="dayError"
        class="text-button"
        :disabled="busy"
        @click="retryDay"
      >
        서버에서 다시 불러오기
      </button></Modal
    >
  </div>
</template>
