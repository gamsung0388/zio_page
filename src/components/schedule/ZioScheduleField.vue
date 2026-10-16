<template>
  <div
    class="schedule-field"
    :class="[
      multiline ? 'content-field' : 'time-field',
      { 'field-overflow': overflowing },
    ]"
  >
    <div ref="textElement" class="schedule-text" aria-hidden="true">
      <span ref="textContent" class="schedule-text-content">
        <template v-if="displayValue">{{
          displayValue + (multiline ? "\u200b" : "")
        }}</template>
        <span v-else class="schedule-placeholder" data-html2canvas-ignore>{{
          placeholder
        }}</span>
      </span>
    </div>
    <textarea
      v-if="multiline"
      ref="controlElement"
      class="schedule-control"
      :value="value"
      :aria-label="label"
      :disabled="disabled"
      :maxlength="maxlength"
      spellcheck="false"
      data-html2canvas-ignore
      @input="emit('update', $event.target.value)"
    />
    <input
      v-else
      :maxlength="maxlength"
      class="schedule-control"
      :value="value"
      :aria-label="label"
      :disabled="disabled"
      spellcheck="false"
      data-html2canvas-ignore
      @input="emit('update', $event.target.value)"
    />
  </div>
</template>

<script setup>
import { onMounted, onUpdated, ref } from "vue";

defineProps({
  value: { type: String, required: true },
  displayValue: { type: String, required: true },
  label: { type: String, required: true },
  placeholder: { type: String, default: "" },
  multiline: { type: Boolean, default: false },
  maxlength: Number,
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(["update", "overflow"]);
const textElement = ref(null);
const textContent = ref(null);
const controlElement = ref(null);
const overflowing = ref(false);

function checkOverflow() {
  const element = textElement.value;
  // textarea는 세로 정렬을 지원하지 않아 표시 텍스트의 실제 줄 높이에 맞춘다.
  // 칸을 넘는 내용은 위에서부터 표시해 입력 시작 부분이 잘리지 않게 한다.
  if (controlElement.value) {
    const padding = Math.max(
      7,
      (element.clientHeight - textContent.value.offsetHeight) / 2,
    );
    controlElement.value.style.paddingTop = padding + "px";
    controlElement.value.style.paddingBottom = padding + "px";
  }
  const detected =
    element.scrollHeight > element.clientHeight + 1 ||
    element.scrollWidth > element.clientWidth + 1;
  if (detected !== overflowing.value) {
    overflowing.value = detected;
    emit("overflow", detected);
  }
  return detected;
}
defineExpose({ checkOverflow });

onMounted(checkOverflow);
onUpdated(checkOverflow);
</script>

<style scoped>
.field-overflow {
  outline: 3px solid #b43b30;
  outline-offset: -2px;
}
.schedule-field {
  position: absolute;
  line-height: 1.22;
  font-family: "Pretendard", "Noto Sans KR", system-ui, sans-serif;
  text-shadow:
    0 1px 0 #ffffffcc,
    0 0 6px #ffffffe6;
}

.schedule-text,
.schedule-control {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 4px;
  margin: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: inherit;
  line-height: inherit;
  text-shadow: inherit;
  overflow: hidden;
}

.content-field .schedule-text,
.content-field .schedule-control {
  padding: 7px 22px;
  white-space: pre-wrap;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.content-field .schedule-text {
  display: flex;
  flex-direction: column;
}

.content-field .schedule-text-content {
  flex: none;
  width: 100%;
  margin-block: auto;
}

.time-field .schedule-text,
.time-field .schedule-control {
  padding: 0 8px;
  white-space: nowrap;
}

.time-field .schedule-text {
  display: flex;
  align-items: center;
  justify-content: center;
}

.schedule-control {
  position: absolute;
  inset: 0;
  resize: none;
  opacity: 0;
}

.schedule-control:focus {
  opacity: 1;
  outline: 2px solid #397329;
  outline-offset: 2px;
  background: #ffffff33;
}

.schedule-field:focus-within .schedule-text {
  visibility: hidden;
}

.schedule-placeholder {
  color: #46693670;
  text-shadow: none;
}

/* 캡처에는 정적 텍스트만 남긴다. 편집 커서와 입력 요소의 그림자를 제외한다. */
:global(.exporting) .schedule-text {
  visibility: visible;
}
</style>
