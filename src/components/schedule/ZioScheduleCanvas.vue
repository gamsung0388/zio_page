<template>
  <div class="preview-wrap">
    <div class="preview-tools">
      <p>
        칸을 눌러 입력하세요. 시간 편집 중에는 콜론을 포함한 원래 값을 표시해요.
      </p>
      <button
        type="button"
        :disabled="isExporting"
        :aria-pressed="originalSize"
        @click="originalSize = !originalSize"
      >
        {{ originalSize ? "화면에 맞춤" : "원본 크기로 보기" }}
      </button>
    </div>
    <p v-if="overflowFields.size" class="overflow-warning" role="status">
      {{ [...overflowFields.values()].join(", ") }}의 글자가 칸을 넘어요.
      내용이나 글자 크기를 줄여주세요.
    </p>
    <div ref="viewport" class="preview-viewport">
      <div class="preview-frame" :style="frameStyle">
        <section
          ref="canvas"
          class="schedule-canvas"
          :style="canvasStyle"
          aria-label="주간 스케줄 미리보기"
          :aria-busy="isExporting"
        >
          <img
            class="schedule-template"
            :src="templateSrc"
            alt="지오 주간 스케줄표 템플릿"
            draggable="false"
          />
          <div v-if="weekLabel" class="schedule-week-label">
            {{ weekLabel }}
          </div>
          <template v-for="row in rows" :key="row.key">
            <ZioScheduleField
              ref="fields"
              :value="scheduleForm[row.key].content"
              :display-value="scheduleForm[row.key].content"
              :label="row.label + '요일 방송 내용'"
              :placeholder="row.label + '요일 방송 내용'"
              :style="row.contentStyle"
              :disabled="isExporting"
              multiline
              :maxlength="500"
              @update="emit('update-day-field', row.key, 'content', $event)"
              @overflow="
                setOverflow(
                  row.key + '-content',
                  row.label + '요일 내용',
                  $event,
                )
              "
            />
            <ZioScheduleField
              ref="fields"
              :value="scheduleForm[row.key].time"
              :display-value="
                formatTime(scheduleForm[row.key].time, editorOptions.hideColon)
              "
              :label="row.label + '요일 방송 시간'"
              placeholder="20:00"
              :maxlength="40"
              :style="row.timeStyle"
              :disabled="isExporting"
              @update="emit('update-day-field', row.key, 'time', $event)"
              @overflow="
                setOverflow(row.key + '-time', row.label + '요일 시간', $event)
              "
            />
          </template>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  CANVAS_SIZE,
  DAY_OPTIONS,
  TEMPLATE_MAP,
} from "../../../shared/schedule/scheduleConfig.js";
import { formatTime, getFieldStyle } from "../../schedule/scheduleLayout.js";
import { normalizeTemplate } from "../../../shared/schedule/scheduleFactory.js";
import ZioScheduleField from "./ZioScheduleField.vue";

const props = defineProps({
  weekLabel: { type: String, default: "" },
  selectedTemplate: { type: String, required: true },
  scheduleForm: { type: Object, required: true },
  editorOptions: { type: Object, required: true },
  isExporting: { type: Boolean, default: false },
});
const emit = defineEmits(["update-day-field"]);
const canvas = ref(null);
const fields = ref([]);
const viewport = ref(null);
const viewportWidth = ref(CANVAS_SIZE.width);
const originalSize = ref(false);
const overflowFields = reactive(new Map());

function setOverflow(key, label, overflowing) {
  if (overflowing) overflowFields.set(key, label);
  else overflowFields.delete(key);
}
const scale = computed(() =>
  originalSize.value ? 1 : Math.min(1, viewportWidth.value / CANVAS_SIZE.width),
);
const frameStyle = computed(() => ({
  width: CANVAS_SIZE.width * scale.value + "px",
  height: CANVAS_SIZE.height * scale.value + "px",
}));
const canvasStyle = computed(() => ({
  width: CANVAS_SIZE.width + "px",
  height: CANVAS_SIZE.height + "px",
  transform: "scale(" + scale.value + ")",
}));
const template = computed(
  () => TEMPLATE_MAP[normalizeTemplate(props.selectedTemplate)],
);
const templateSrc = computed(
  () => import.meta.env.BASE_URL + template.value.value,
);
const rows = computed(() =>
  DAY_OPTIONS.map((day, index) => ({
    ...day,
    contentStyle: getFieldStyle(
      template.value.layout,
      props.editorOptions,
      index,
      "content",
    ),
    timeStyle: getFieldStyle(
      template.value.layout,
      props.editorOptions,
      index,
      "time",
    ),
  })),
);

let observer;
let resizeFrame;
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      viewportWidth.value = entry.contentRect.width;
    });
  });
  observer.observe(viewport.value);
});
onUnmounted(() => {
  observer?.disconnect();
  cancelAnimationFrame(resizeFrame);
});
async function checkOverflow() {
  if (document.fonts?.ready) await document.fonts.ready;
  await nextTick();
  for (const field of fields.value) field.checkOverflow();
  return [...overflowFields.entries()].map(([key, label]) => ({ key, label }));
}
defineExpose({ element: canvas, checkOverflow });
</script>

<style scoped>
.preview-wrap {
  width: 100%;
  max-width: 1672px;
  min-width: 0;
  margin: 0 auto;
}
.preview-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.preview-tools p {
  font-size: 13px;
  color: #527646;
}
.overflow-warning {
  margin-bottom: 10px;
  color: #963f27;
  font-size: 13px;
}
.preview-tools button {
  flex-shrink: 0;
  border: 1px solid #bfdcac;
  border-radius: 10px;
  background: white;
  padding: 8px 12px;
  color: #35632a;
  cursor: pointer;
}
.preview-viewport {
  overflow: auto;
}
.preview-frame {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
  border-radius: 16px;
}
.schedule-canvas {
  position: relative;
  transform-origin: top left;
  background: white;
  overflow: hidden;
}
.schedule-week-label {
  position: absolute;
  z-index: 1;
  bottom: 8px;
  left: 310px;
  color: #385a2d;
  font:
    600 15px system-ui,
    sans-serif;
  background: #ffffffd9;
  padding: 2px 10px;
  border-radius: 5px;
}
.schedule-template {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  user-select: none;
  pointer-events: none;
}
@media (max-width: 600px) {
  .preview-tools {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
