<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue";
import { api } from "../../services/api.js";
import { useEditorDraft } from "../../services/useEditorDraft.js";
import { useEditorGuard } from "../../services/editor-guards.js";
import {
  EVENT_KINDS,
  TIME_MODES,
  EVENT_DATE_MIN,
  EVENT_DATE_MAX,
  emptyEvent,
  eventInput,
  validateEventPayload,
  isEventDraft,
} from "../../../shared/schedule/events.js";
import { backupEventsFile } from "../../schedule/events-service.js";
import Modal from "../Modal.vue";
import DraftRecovery from "../DraftRecovery.vue";
import Notice from "../Notice.vue";
const props = defineProps({
  eventId: { type: String, required: true },
  date: { type: String, required: true },
  initial: Object,
});
const emit = defineEmits(["close", "saved", "deleted"]);
const isNew = computed(() => props.eventId === "new"),
  form = reactive(emptyEvent(props.date)),
  revision = ref(0),
  loading = ref(true),
  loadError = ref(""),
  error = ref(""),
  busy = ref(false),
  complete = ref(false),
  baseline = ref("");
const controller = new AbortController();
function snapshot() {
  return { form: { ...form }, revision: revision.value };
}
const dirty = computed(
  () => Boolean(baseline.value) && JSON.stringify(form) !== baseline.value,
);
const drafts = useEditorDraft({
  scope: computed(
    () => "event:" + (isNew.value ? "new:" + props.date : props.eventId),
  ),
  ready: computed(() => !loading.value && !loadError.value),
  dirty,
  snapshot,
  validate: isEventDraft,
  apply(value) {
    Object.assign(form, value.form);
    revision.value = value.revision;
  },
});
const { pending, storageError } = drafts;
useEditorGuard(() => dirty.value || busy.value);
function input() {
  const value = eventInput(form);
  if (value.time_mode !== "timed") {
    value.start_time = "";
    value.end_time = "";
  }
  return value;
}
async function load() {
  loading.value = true;
  loadError.value = "";
  error.value = "";
  try {
    const value = isNew.value
      ? emptyEvent(props.date)
      : await api("/admin/schedule-events/" + props.eventId, {
          signal: controller.signal,
        });
    Object.assign(form, eventInput(value));
    revision.value = value.revision || 0;
    baseline.value = JSON.stringify(form);
    if (isNew.value && props.initial)
      Object.assign(form, eventInput(props.initial));
  } catch (err) {
    if (err.name !== "AbortError") loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}
function changeStart(value) {
  if (form.end_date === form.start_date) form.end_date = value;
  form.start_date = value;
}
async function save(image = false) {
  if (busy.value) return;
  error.value = "";
  let payload;
  try {
    payload = eventInput(validateEventPayload(input()));
  } catch (err) {
    error.value = err.message;
    return;
  }
  drafts.persist();
  busy.value = true;
  try {
    const saved = await api(
      "/admin/schedule-events" + (isNew.value ? "" : "/" + props.eventId),
      {
        method: isNew.value ? "POST" : "PUT",
        body: {
          ...payload,
          ...(isNew.value ? {} : { expected_revision: revision.value }),
        },
      },
    );
    revision.value = saved.revision;
    baseline.value = JSON.stringify(form);
    drafts.clear();
    complete.value = true;
    emit("saved", saved, image);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (
    busy.value ||
    !window.confirm(
      "이 일정만 삭제할까요? 다른 일정과 주간 이미지 메모는 유지됩니다.",
    )
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    await api("/admin/schedule-events/" + props.eventId, {
      method: "DELETE",
      body: { expected_revision: revision.value },
    });
    baseline.value = JSON.stringify(form);
    drafts.clear();
    complete.value = true;
    emit("deleted");
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
function confirmLeave() {
  if (busy.value && !complete.value) return false;
  if (
    dirty.value &&
    !window.confirm("저장하지 않은 일정 변경을 버리고 이동할까요?")
  )
    return false;
  drafts.clear();
  baseline.value = JSON.stringify(form);
  return true;
}
function reload() {
  if (
    !dirty.value ||
    window.confirm("입력을 버리고 저장된 일정을 다시 불러올까요?")
  ) {
    drafts.clear();
    load();
  }
}
function backup() {
  try {
    backupEventsFile(
      [validateEventPayload(input())],
      "zio-event-draft-" + form.start_date,
    );
  } catch (err) {
    error.value = err.message;
  }
}
function beforeUnload(event) {
  if (dirty.value || busy.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => {
  load();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => {
  controller.abort();
  window.removeEventListener("beforeunload", beforeUnload);
});
defineExpose({ confirmLeave });
</script>
<template>
  <Modal
    :title="isNew ? '새 일정 등록' : '일정 수정'"
    :busy="busy"
    wide
    @close="emit('close')"
    ><Notice :loading="loading" :error="loadError" @retry="load" />
    <form
      v-if="!loading && !loadError"
      class="schedule-event-form"
      @submit.prevent="save()"
    >
      <DraftRecovery
        :pending="pending"
        :error="storageError"
        @restore="drafts.restore"
        @discard="drafts.clear"
      />
      <fieldset class="editor-fields" :disabled="busy">
        <label class="field"
          >일정 제목<input
            v-model="form.title"
            maxlength="120"
            required
            placeholder="예: 노래 방송 / 게임 합방" /></label
        ><label class="field"
          >일정 구분<select v-model="form.kind">
            <option
              v-for="kind in EVENT_KINDS"
              :key="kind.value"
              :value="kind.value"
            >
              {{ kind.label }}
            </option>
          </select></label
        >
        <fieldset class="event-time-modes">
          <legend>시간 방식</legend>
          <label v-for="mode in TIME_MODES" :key="mode.value"
            ><input
              v-model="form.time_mode"
              type="radio"
              name="timeMode"
              :value="mode.value"
            />{{ mode.label }}</label
          >
        </fieldset>
        <div class="event-date-grid">
          <label class="field"
            >시작일<input
              type="date"
              :value="form.start_date"
              :min="EVENT_DATE_MIN"
              :max="EVENT_DATE_MAX"
              required
              @input="changeStart($event.target.value)" /></label
          ><label class="field"
            >종료일<input
              v-model="form.end_date"
              type="date"
              :min="form.start_date || EVENT_DATE_MIN"
              :max="EVENT_DATE_MAX"
              required /></label
          ><label v-if="form.time_mode === 'timed'" class="field"
            >시작 시간<input
              v-model="form.start_time"
              type="time"
              step="60"
              required /></label
          ><label v-if="form.time_mode === 'timed'" class="field"
            >종료 시간<input
              v-model="form.end_time"
              type="time"
              step="60"
              required
          /></label>
        </div>
        <p class="form-hint">
          한국 시간 기준 ·
          {{
            form.time_mode === "timed"
              ? "자정을 넘기는 일정은 종료일을 다음 날짜로 선택하세요."
              : "종료일까지 포함합니다."
          }}
          기간은 최대 366일입니다.
        </p>
        <label class="field"
          >일정 메모<textarea
            v-model="form.description"
            rows="3"
            maxlength="2000"
            placeholder="이 일정에 필요한 안내를 적어주세요."
          />
        </label>
      </fieldset>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="event-dialog-secondary">
        <button
          v-if="!isNew"
          class="text-button"
          type="button"
          :disabled="busy"
          @click="remove"
        >
          이 일정 삭제</button
        ><button
          class="text-button"
          type="button"
          :disabled="busy"
          @click="backup"
        >
          현재 입력 백업</button
        ><button
          v-if="!isNew"
          class="text-button"
          type="button"
          :disabled="busy"
          @click="reload"
        >
          저장된 일정 다시 불러오기
        </button>
      </div>
      <div class="modal-actions">
        <button
          class="button secondary"
          type="button"
          :disabled="busy"
          @click="emit('close')"
        >
          취소</button
        ><button
          class="button secondary"
          type="button"
          :disabled="busy"
          @click="save(true)"
        >
          저장하고 이미지 만들기</button
        ><button class="button primary" :disabled="busy">
          {{ busy ? "저장 중…" : "일정 저장" }}
        </button>
      </div>
    </form></Modal
  >
</template>
