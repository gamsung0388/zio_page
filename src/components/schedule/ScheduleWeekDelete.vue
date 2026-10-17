<script setup>
import { ref, computed } from "vue";
import { api } from "../../services/api.js";
import { useEditorGuard } from "../../services/editor-guards.js";
import { downloadScheduleBackup } from "../../schedule/backup.js";
import { DAY_OPTIONS } from "../../../shared/schedule/scheduleConfig.js";
import { addDays } from "../../../shared/schedule/dates.js";
import Modal from "../Modal.vue";
const props = defineProps({
  week: { type: Object, required: true },
  discardDraft: Boolean,
});
const emit = defineEmits(["close", "deleted", "busy"]);
const busy = ref(false),
  error = ref("");
const period = computed(
  () => props.week.week_start + " ~ " + addDays(props.week.week_start, 6),
);
useEditorGuard(() => busy.value);
function backup() {
  try {
    downloadScheduleBackup(
      [props.week],
      "zio-week-before-delete-" + props.week.week_start,
    );
  } catch (err) {
    error.value = err.message;
  }
}
async function remove() {
  if (busy.value) return;
  error.value = "";
  busy.value = true;
  emit("busy", true);
  try {
    const result = await api("/admin/schedules/" + props.week.week_start, {
      method: "DELETE",
      body: { expected_revision: props.week.revision },
    });
    emit("deleted", result);
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
    emit("busy", false);
  }
}
</script>
<template>
  <Modal
    title="주간 메모 삭제"
    :busy="busy"
    class="week-delete-dialog"
    @close="emit('close')"
  >
    <p class="week-delete-period">
      <strong>{{ period }}</strong>
    </p>
    <p class="week-delete-warning">
      이 주의 7일치 내용·시간과 이미지 꾸미기 설정을 삭제합니다. 일정 달력의
      개별 일정과 다른 주의 메모는 유지됩니다.
    </p>
    <p v-if="discardDraft" class="week-delete-warning">
      현재 편집 중인 미저장 내용도 비워집니다.
    </p>
    <ul class="week-delete-preview" aria-label="삭제할 주간 메모 내용">
      <li v-for="day in DAY_OPTIONS" :key="day.key">
        <strong
          >{{ day.label }} ·
          {{
            addDays(week.week_start, DAY_OPTIONS.indexOf(day))
              .slice(5)
              .replace("-", "/")
          }}</strong
        ><span>{{ week.scheduleForm[day.key].time || "시간 안내 없음" }}</span>
        <p>{{ week.scheduleForm[day.key].content || "내용 없음" }}</p>
      </li>
    </ul>
    <button class="text-button" :disabled="busy" @click="backup">
      삭제 전 JSON 백업
    </button>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <p class="form-hint">
      삭제 후에는 미리 받은 백업을 가져와 복구할 수 있습니다.
    </p>
    <div class="modal-actions">
      <button class="button secondary" :disabled="busy" @click="emit('close')">
        취소</button
      ><button
        class="button week-delete-confirm"
        :disabled="busy || Boolean(error)"
        @click="remove"
      >
        {{ busy ? "삭제 중…" : "이 주 메모 삭제" }}
      </button>
    </div>
  </Modal>
</template>
