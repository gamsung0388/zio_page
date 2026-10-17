<script setup>
import {
  computed,
  ref,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import {
  useRoute,
  useRouter,
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
} from "vue-router";
import {
  mondayOf,
  isDate,
  addDays,
  dateLabel,
} from "../../shared/schedule/dates.js";
import {
  DAY_OPTIONS,
  TEMPLATE_LIST,
  FONT_SIZE_LIMITS,
} from "../../shared/schedule/scheduleConfig.js";
import { fetchEvents } from "../schedule/events-service.js";
import {
  eventInput,
  eventPeriodLabel,
  projectEventsToWeek,
} from "../../shared/schedule/events.js";
import { useScheduleEditor } from "../schedule/useScheduleEditor.js";
import { useKstToday } from "../schedule/useKstToday.js";
import { exportElementImage } from "../schedule/exportImage.js";
import {
  downloadScheduleBackup,
  readScheduleBackup,
  loadAllScheduleWeeks,
} from "../schedule/backup.js";
import { api } from "../services/api.js";
import ScheduleNav from "../components/schedule/ScheduleNav.vue";
import ZioEditorToolbar from "../components/schedule/ZioEditorToolbar.vue";
import ZioScheduleCanvas from "../components/schedule/ZioScheduleCanvas.vue";
import DraftRecovery from "../components/DraftRecovery.vue";
import Modal from "../components/Modal.vue";
import Notice from "../components/Notice.vue";
const route = useRoute(),
  router = useRouter(),
  canvas = ref(null),
  exporting = ref(false),
  transferring = ref(false),
  today = useKstToday();
const initialWeek = mondayOf(today.value);
const week = computed(() =>
  mondayOf(isDate(route.query.week) ? route.query.week : initialWeek),
);
const editor = useScheduleEditor(week);
const {
  selectedTemplate,
  scheduleForm,
  editorOptions,
  loading,
  saving,
  error,
  actionError,
  notice,
  dirty,
  revision,
  lastSaved,
} = editor;
const { pending, storageError } = editor.drafts;
const locked = computed(
  () => saving.value || exporting.value || transferring.value,
);
const activeDay = ref("mon"),
  dayIndex = computed(() =>
    DAY_OPTIONS.findIndex((day) => day.key === activeDay.value),
  );
const activeLabel = computed(() => DAY_OPTIONS[dayIndex.value].label + "요일");
const weekLabel = computed(
  () => dateLabel(week.value) + " ~ " + dateLabel(addDays(week.value, 6)),
);
const saveState = computed(() =>
  saving.value
    ? "저장 중…"
    : dirty.value
      ? "저장하지 않은 변경이 있어요"
      : revision.value === 0
        ? "아직 저장하지 않은 주예요"
        : "저장 완료",
);
const savedLabel = computed(() =>
  lastSaved.value
    ? new Date(lastSaved.value).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      })
    : "",
);
const copyOpen = ref(false),
  copyWeek = ref(null),
  copyOptions = ref({ content: true, time: true, style: false }),
  copyError = ref("");
const importData = ref(null),
  importWeek = ref("");
watch(week, editor.load, { immediate: true });
const eventImportOpen = ref(false),
  eventLoading = ref(false),
  eventItems = ref([]),
  eventSelected = ref([]),
  eventError = ref(""),
  includeEmpty = ref(false),
  autoImportWeek = ref("");
let eventController;
watch(
  [loading, () => route.query.events],
  () => {
    if (
      !loading.value &&
      !error.value &&
      route.query.events === "1" &&
      autoImportWeek.value !== week.value
    ) {
      autoImportWeek.value = week.value;
      openEvents();
    }
  },
  { immediate: true },
);
async function openEvents() {
  if (locked.value) return;
  eventController?.abort();
  eventController = new AbortController();
  eventItems.value = [];
  eventSelected.value = [];
  includeEmpty.value = false;
  eventImportOpen.value = true;
  eventLoading.value = true;
  transferring.value = true;
  eventError.value = "";
  try {
    eventItems.value = await fetchEvents(week.value, addDays(week.value, 6), {
      signal: eventController.signal,
    });
    eventSelected.value = eventItems.value
      .filter((item) => ["broadcast", "collab", "off"].includes(item.kind))
      .map((item) => item.id);
  } catch (err) {
    if (err.name !== "AbortError") eventError.value = err.message;
  } finally {
    eventLoading.value = false;
    transferring.value = false;
  }
}
function applyEvents() {
  try {
    const selected = eventItems.value.filter((item) =>
      eventSelected.value.includes(item.id),
    );
    if (!selected.length) throw new Error("가져올 일정을 선택해주세요.");
    const projected = projectEventsToWeek(selected, week.value);
    if (
      !window.confirm(
        "선택한 일정으로 이 주의 내용·시간을 채울까요? 일정 저장 전에는 기존 이미지 메모가 유지됩니다.",
      )
    )
      return;
    for (const [day, value] of Object.entries(projected))
      if (includeEmpty.value || value.content || value.time) {
        editor.updateDayField(day, "content", value.content);
        editor.updateDayField(day, "time", value.time);
      }
    eventImportOpen.value = false;
    notice.value =
      "일정을 가져왔어요. 이미지 미리보기를 확인하고 필요한 경우 일정 저장을 눌러주세요.";
  } catch (err) {
    eventError.value = err.message;
  }
}
onBeforeUnmount(() => eventController?.abort());
async function navigateWeek(date, input) {
  try {
    if (isDate(date) && !locked.value)
      await router.push({ query: { week: mondayOf(date) } });
  } finally {
    if (input) input.value = week.value;
  }
}
function leave(to, from) {
  if (to.path === "/admin/login" || to.path === "/admin/password") return true;
  if (to.fullPath === from.fullPath) return true;
  return !locked.value && editor.confirmLeave();
}
onBeforeRouteLeave(leave);
onBeforeRouteUpdate(leave);
function beforeUnload(event) {
  if (dirty.value || locked.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
function startAction() {
  actionError.value = "";
  notice.value = "";
}
async function download(type) {
  if (locked.value) return;
  exporting.value = true;
  startAction();
  notice.value = "이미지를 만드는 중이에요…";
  try {
    const overflow = await canvas.value.checkOverflow();
    if (overflow.length)
      throw new Error(
        overflow.map((item) => item.label).join(", ") +
          "의 글자가 칸을 넘어요. 글자 자동 맞춤을 누르거나 내용을 줄여주세요.",
      );
    await exportElementImage(
      canvas.value.element,
      type,
      "zio-weekly-" + week.value,
    );
    notice.value = "이미지를 만들었어요. 다운로드를 확인해주세요.";
  } catch (err) {
    notice.value = "";
    actionError.value = "이미지를 저장하지 못했어요. " + err.message;
  } finally {
    exporting.value = false;
  }
}
async function autoFit() {
  if (locked.value) return;
  exporting.value = true;
  startAction();
  try {
    let overflow = await canvas.value.checkOverflow();
    for (let attempt = 0; overflow.length && attempt < 50; attempt++) {
      let changed = false;
      for (const [suffix, option] of [
        ["content", "contentFontSize"],
        ["time", "timeFontSize"],
      ]) {
        if (
          overflow.some((item) => item.key.endsWith(suffix)) &&
          editorOptions[option] > FONT_SIZE_LIMITS[option].min
        ) {
          editor.updateEditorOption(option, editorOptions[option] - 1);
          changed = true;
        }
      }
      if (!changed) break;
      await nextTick();
      overflow = await canvas.value.checkOverflow();
    }
    if (overflow.length)
      throw new Error(
        "최소 글자 크기로도 " +
          overflow.map((item) => item.label).join(", ") +
          "가 넘쳐요. 내용이나 줄 수를 줄여주세요.",
      );
    notice.value = "글자를 이미지 칸에 맞췄어요. 미리보기를 확인해주세요.";
  } catch (err) {
    actionError.value = err.message;
  } finally {
    exporting.value = false;
  }
}
function quick(value) {
  editor.updateDayField(
    activeDay.value,
    value === "휴방" ? "content" : "time",
    value,
  );
  if (value === "휴방") editor.updateDayField(activeDay.value, "time", "");
}
function copyDay() {
  if (dayIndex.value < 1) return;
  if (!window.confirm(activeLabel.value + "에 전날 내용을 복사할까요?")) return;
  Object.assign(
    scheduleForm[activeDay.value],
    scheduleForm[DAY_OPTIONS[dayIndex.value - 1].key],
  );
}
async function openCopy() {
  copyOpen.value = true;
  copyWeek.value = null;
  copyError.value = "";
  transferring.value = true;
  try {
    const data = await api("/admin/schedules/" + addDays(week.value, -7));
    if (!data.revision) throw new Error("지난주에 저장한 일정이 없어요.");
    copyWeek.value = data;
  } catch (err) {
    copyError.value = err.message;
  } finally {
    transferring.value = false;
  }
}
function applyCopy() {
  if (!copyWeek.value || !Object.values(copyOptions.value).some(Boolean))
    return;
  if (
    !window.confirm(
      weekLabel.value + "의 선택한 항목을 지난주 내용으로 바꿀까요?",
    )
  )
    return;
  for (const { key } of DAY_OPTIONS)
    for (const field of ["content", "time"])
      if (copyOptions.value[field])
        editor.updateDayField(
          key,
          field,
          copyWeek.value.scheduleForm[key][field],
        );
  if (copyOptions.value.style) {
    editor.updateSelectedTemplate(copyWeek.value.selectedTemplate);
    Object.assign(editorOptions, copyWeek.value.editorOptions);
  }
  copyOpen.value = false;
  notice.value = "지난주 내용을 가져왔어요. 확인한 뒤 일정 저장을 눌러주세요.";
}
async function backup(all = false) {
  if (locked.value) return;
  transferring.value = true;
  startAction();
  try {
    const weeks = all
      ? await loadAllScheduleWeeks()
      : [{ week_start: week.value, ...editor.snapshot() }];
    downloadScheduleBackup(
      weeks,
      all ? "zio-schedules-" + today.value : "zio-schedule-" + week.value,
    );
    notice.value = all
      ? "저장된 전체 일정의 백업을 만들었어요."
      : "현재 편집 내용의 백업을 만들었어요.";
  } catch (err) {
    actionError.value = err.message;
  } finally {
    transferring.value = false;
  }
}
async function importFile(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || locked.value) return;
  transferring.value = true;
  startAction();
  try {
    const data = await readScheduleBackup(file);
    if (!data.weeks.length) throw new Error("백업에 일정이 없어요.");
    importData.value = data;
    importWeek.value = data.weeks[0].week_start;
  } catch (err) {
    actionError.value = err.message;
  } finally {
    transferring.value = false;
  }
}
function applyImport() {
  const source = importData.value?.weeks.find(
    (item) => item.week_start === importWeek.value,
  );
  if (
    !source ||
    !window.confirm(
      source.week_start +
        " 주의 백업을 현재 " +
        week.value +
        " 주에 가져올까요?",
    )
  )
    return;
  editor.apply(source);
  importData.value = null;
  notice.value =
    "백업을 편집 화면에 가져왔어요. 확인한 뒤 일정 저장을 눌러주세요.";
}
</script>
<template>
  <div class="schedule-page">
    <div class="page-intro">
      <div>
        <span class="eyebrow">ZIO WEEKLY SCHEDULE</span>
        <h1>주간 스케줄 이미지 <span class="heading-sprout">✿</span></h1>
        <p>일정을 입력하고 미리보기를 확인한 뒤 이미지로 내려받으세요.</p>
      </div>
    </div>
    <ScheduleNav />
    <p class="schedule-context-note">
      이 화면의 저장은 주간 이미지 메모에 반영됩니다. 개별 일정은
      <RouterLink
        :to="{ path: '/admin/schedule', query: { month: week.slice(0, 7) } }"
        >일정 달력으로 이동</RouterLink
      >해서 관리하세요.
    </p>
    <div class="schedule-week-picker card">
      <button
        class="btn btn-outline"
        :disabled="locked"
        aria-label="이전 주"
        @click="navigateWeek(addDays(week, -7))"
      >
        ←</button
      ><label
        >주 선택<input
          type="date"
          :value="week"
          :disabled="locked"
          @change="navigateWeek($event.target.value, $event.target)" /></label
      ><button
        class="btn btn-outline"
        :disabled="locked"
        aria-label="다음 주"
        @click="navigateWeek(addDays(week, 7))"
      >
        →</button
      ><button
        class="btn btn-outline"
        :disabled="locked"
        @click="navigateWeek(today)"
      >
        이번 주</button
      ><strong>{{ weekLabel }}</strong
      ><span class="schedule-save-state"
        >{{ saveState
        }}<small v-if="savedLabel"
          >마지막 저장 {{ savedLabel }} (한국 시간)</small
        ></span
      >
    </div>
    <Notice
      loading-message="일정을 불러오고 있어요."
      :loading="loading"
      :error="error"
      @retry="editor.load"
    />
    <template v-if="!loading && !error">
      <DraftRecovery
        :pending="pending"
        :error="storageError"
        @restore="editor.drafts.restore"
        @discard="editor.drafts.clear"
      />
      <div class="schedule-action-bar">
        <button class="btn btn-primary" :disabled="locked" @click="editor.save">
          {{ saving ? "저장 중…" : "일정 저장" }}</button
        ><button
          class="btn btn-outline"
          :disabled="locked"
          @click="editor.reload"
        >
          저장된 일정 불러오기
        </button>
        <button class="btn btn-outline" :disabled="locked" @click="openEvents">
          등록된 일정 가져오기
        </button>
        <div class="schedule-image-actions">
          <button
            class="btn btn-lime"
            :disabled="locked"
            @click="download('png')"
          >
            PNG 저장</button
          ><button
            class="btn btn-outline"
            :disabled="locked"
            @click="download('jpeg')"
          >
            JPEG 저장</button
          ><button class="btn btn-outline" :disabled="locked" @click="autoFit">
            글자 자동 맞춤
          </button>
        </div>
      </div>
      <p
        v-if="actionError"
        class="form-error schedule-action-error"
        role="alert"
      >
        {{ actionError }}
      </p>
      <p class="schedule-export-notice" role="status" aria-live="polite">
        {{ notice }}
      </p>
      <div class="schedule-workspace">
        <div class="schedule-input-column">
          <section class="card schedule-input-panel">
            <h2>날짜별 일정</h2>
            <fieldset class="editor-fields" :disabled="locked">
              <div
                class="schedule-day-tabs"
                role="group"
                aria-label="입력할 요일"
              >
                <button
                  v-for="day in DAY_OPTIONS"
                  :key="day.key"
                  type="button"
                  :aria-pressed="activeDay === day.key"
                  @click="activeDay = day.key"
                >
                  {{ day.label }}
                </button>
              </div>
              <h3>
                {{ activeLabel }} ·
                {{ addDays(week, dayIndex).slice(5).replace("-", "/") }}
              </h3>
              <label class="field"
                >{{ activeLabel }} 내용<textarea
                  :value="scheduleForm[activeDay].content"
                  rows="4"
                  maxlength="500"
                  @input="
                    editor.updateDayField(
                      activeDay,
                      'content',
                      $event.target.value,
                    )
                  "
                /></label
              ><label class="field"
                >{{ activeLabel }} 시간<input
                  :value="scheduleForm[activeDay].time"
                  maxlength="40"
                  placeholder="20:00 / 미정"
                  @input="
                    editor.updateDayField(
                      activeDay,
                      'time',
                      $event.target.value,
                    )
                  "
              /></label>
              <div class="schedule-quick-actions">
                <button
                  type="button"
                  class="btn btn-outline"
                  @click="quick('휴방')"
                >
                  휴방 입력</button
                ><button
                  type="button"
                  class="btn btn-outline"
                  @click="quick('미정')"
                >
                  시간 미정</button
                ><button
                  type="button"
                  class="btn btn-outline"
                  :disabled="dayIndex === 0"
                  @click="copyDay"
                >
                  전날 복사
                </button>
              </div>
            </fieldset>
            <div class="schedule-week-overview">
              <button
                v-for="day in DAY_OPTIONS"
                :key="day.key"
                :disabled="locked"
                type="button"
                @click="activeDay = day.key"
              >
                <strong>{{ day.label }}</strong
                ><span>{{ scheduleForm[day.key].content || "내용 없음" }}</span
                ><small>{{ scheduleForm[day.key].time }}</small>
              </button>
            </div>
          </section>
          <details class="schedule-design-details">
            <summary>이미지 꾸미기 · 템플릿·글자·색상</summary>
            <ZioEditorToolbar
              :template-options="TEMPLATE_LIST"
              :selected-template="selectedTemplate"
              :editor-options="editorOptions"
              :is-exporting="locked"
              @update:selected-template="editor.updateSelectedTemplate"
              @update:editor-option="editor.updateEditorOption"
              @toggle-option="editor.toggleOption"
              @reset-schedule="editor.resetSchedule"
              @reset-all="editor.resetAll"
            />
          </details>
          <details class="card schedule-backup-panel">
            <summary>일정 복사와 백업</summary>
            <div class="schedule-backup-actions">
              <button
                class="btn btn-outline"
                :disabled="locked"
                @click="openCopy"
              >
                지난주 가져오기</button
              ><button
                class="btn btn-outline"
                :disabled="locked"
                @click="backup(false)"
              >
                현재 주 JSON 백업</button
              ><button
                class="btn btn-outline"
                :disabled="locked"
                @click="backup(true)"
              >
                전체 일정 JSON 백업</button
              ><label class="btn btn-outline backup-upload"
                >백업에서 가져오기<input
                  aria-label="일정 백업 파일"
                  type="file"
                  accept=".json,application/json"
                  :disabled="locked"
                  @change="importFile"
              /></label>
            </div>
            <p class="schedule-help">
              현재 주 백업은 미저장 내용을 포함하고, 전체 백업은 저장된 일정만
              포함해요. 가져온 내용은 확인 후 직접 저장합니다.
            </p>
          </details>
        </div>
        <section class="schedule-preview-column">
          <h2>이미지 미리보기</h2>
          <ZioScheduleCanvas
            ref="canvas"
            :week-label="weekLabel"
            :selected-template="selectedTemplate"
            :schedule-form="scheduleForm"
            :editor-options="editorOptions"
            :is-exporting="locked"
            @update-day-field="editor.updateDayField"
          />
          <p class="schedule-help">
            PNG·JPEG · 1672 × 941px. 글자가 넘치면 다운로드를 멈춰요. 이미지를
            내려받은 뒤 다음 편집에서도 유지하려면 일정 저장을 눌러주세요.
          </p>
        </section>
      </div>
    </template>
    <Modal
      v-if="copyOpen"
      title="지난주 일정 가져오기"
      :busy="transferring"
      @close="copyOpen = false"
      ><p v-if="transferring" role="status">지난주 일정을 불러오고 있어요…</p>
      <p v-if="copyError" class="form-error" role="alert">{{ copyError }}</p>
      <template v-if="copyWeek"
        ><p>
          {{ copyWeek.week_start }} 주에서 {{ week }} 주로 가져올 항목을
          선택하세요.
        </p>
        <div class="schedule-copy-options">
          <label
            ><input v-model="copyOptions.content" type="checkbox" />내용</label
          ><label
            ><input v-model="copyOptions.time" type="checkbox" />시간</label
          ><label
            ><input v-model="copyOptions.style" type="checkbox" />템플릿·글자
            스타일</label
          >
        </div>
        <ul class="schedule-copy-preview">
          <li v-for="day in DAY_OPTIONS" :key="day.key">
            {{ day.label }} · {{ copyWeek.scheduleForm[day.key].time }}
            {{ copyWeek.scheduleForm[day.key].content || "내용 없음" }}
          </li>
        </ul>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="copyOpen = false">취소</button
          ><button
            class="btn btn-primary"
            :disabled="!Object.values(copyOptions).some(Boolean)"
            @click="applyCopy"
          >
            선택한 항목 가져오기
          </button>
        </div></template
      ></Modal
    >
    <Modal
      v-if="importData"
      title="백업에서 일정 가져오기"
      @close="importData = null"
      ><p>가져올 주를 선택하세요. 현재 {{ week }} 주의 편집 내용을 바꿉니다.</p>
      <label class="field"
        >백업의 주 선택<select v-model="importWeek">
          <option
            v-for="item in importData.weeks"
            :key="item.week_start"
            :value="item.week_start"
          >
            {{ item.week_start }}
          </option>
        </select></label
      >
      <p>기존 저장 일정은 ‘일정 저장’을 누르기 전까지 유지됩니다.</p>
      <div class="modal-actions">
        <button class="btn btn-outline" @click="importData = null">취소</button
        ><button class="btn btn-primary" @click="applyImport">
          현재 주에 가져오기
        </button>
      </div></Modal
    >
    <Modal
      v-if="eventImportOpen"
      title="등록된 일정 가져오기"
      :busy="eventLoading"
      @close="eventImportOpen = false"
      ><Notice
        loading-message="일정을 불러오고 있어요."
        :loading="eventLoading"
        :error="eventError"
        @retry="openEvents"
      /><template v-if="!eventLoading"
        ><p>
          이미지에 넣을 일정을 선택하세요. 개인·기타 일정은 직접 선택한 경우에만
          포함됩니다.
        </p>
        <p v-if="!eventItems.length" class="form-hint">
          이 주에 등록된 개별 일정이 없어요.
        </p>
        <div class="event-import-options">
          <label v-for="item in eventItems" :key="item.id"
            ><input
              v-model="eventSelected"
              type="checkbox"
              :value="item.id"
            /><span
              ><strong>{{ item.title }}</strong
              ><small>{{ eventPeriodLabel(item) }}</small></span
            ></label
          >
        </div>
        <label class="event-include-empty"
          ><input v-model="includeEmpty" type="checkbox" />선택한 일정이 없는
          날짜도 비우기</label
        >
        <p class="schedule-help">
          한 날짜에 여러 일정이면 내용에 시간과 제목을 함께 넣습니다. 이미지
          글자 넘침은 기존 출력 검사로 확인합니다.
        </p>
        <div class="modal-actions">
          <button class="btn btn-outline" @click="eventImportOpen = false">
            취소</button
          ><button
            class="btn btn-primary"
            :disabled="!eventSelected.length"
            @click="applyEvents"
          >
            선택 일정 채우기
          </button>
        </div></template
      ></Modal
    >
  </div>
</template>
