<script setup>
import {
  ALIGN_OPTIONS,
  FONT_SIZE_LIMITS,
} from "../../../shared/schedule/scheduleConfig.js";
defineProps({
  templateOptions: { type: Array, required: true },
  selectedTemplate: { type: String, required: true },
  editorOptions: { type: Object, required: true },
  isExporting: Boolean,
});
const emit = defineEmits([
  "update:selectedTemplate",
  "update:editorOption",
  "toggle-option",
  "reset-schedule",
  "reset-all",
]);
</script>
<template>
  <fieldset
    class="card schedule-editor-tools"
    :disabled="isExporting"
    :aria-busy="isExporting"
  >
    <legend class="sr-only">스케줄 편집 도구</legend>
    <div class="editor-tools-heading">
      <div>
        <span class="eyebrow">IMAGE SETTINGS</span>
        <h2>이미지 꾸미기</h2>
      </div>
      <span class="output-size">1672 × 941px</span>
    </div>
    <div class="editor-design-grid">
      <div class="design-field template-field">
        <label for="templateSelect">템플릿</label
        ><select
          id="templateSelect"
          :value="selectedTemplate"
          @change="emit('update:selectedTemplate', $event.target.value)"
        >
          <option
            v-for="template in templateOptions"
            :key="template.value"
            :value="template.value"
          >
            {{ template.label }}
          </option>
        </select>
      </div>
      <div class="design-field">
        <div class="design-field-label">
          <label for="contentFontSize">내용 크기</label
          ><output for="contentFontSize"
            >{{ editorOptions.contentFontSize }}px</output
          >
        </div>
        <div class="range-control">
          <input
            id="contentFontSize"
            :value="editorOptions.contentFontSize"
            type="range"
            :min="FONT_SIZE_LIMITS.contentFontSize.min"
            :max="FONT_SIZE_LIMITS.contentFontSize.max"
            @input="
              emit(
                'update:editorOption',
                'contentFontSize',
                Number($event.target.value),
              )
            "
          />
        </div>
      </div>
      <div class="design-field">
        <div class="design-field-label">
          <label for="timeFontSize">시간 크기</label
          ><output for="timeFontSize"
            >{{ editorOptions.timeFontSize }}px</output
          >
        </div>
        <div class="range-control">
          <input
            id="timeFontSize"
            :value="editorOptions.timeFontSize"
            type="range"
            :min="FONT_SIZE_LIMITS.timeFontSize.min"
            :max="FONT_SIZE_LIMITS.timeFontSize.max"
            @input="
              emit(
                'update:editorOption',
                'timeFontSize',
                Number($event.target.value),
              )
            "
          />
        </div>
      </div>
      <div class="design-field">
        <label for="textColor">색상</label>
        <div class="color-control">
          <input
            id="textColor"
            :value="editorOptions.textColor"
            type="color"
            @input="
              emit('update:editorOption', 'textColor', $event.target.value)
            "
          /><span>{{ editorOptions.textColor }}</span>
        </div>
      </div>
      <div class="design-field">
        <label for="alignSelect">정렬</label
        ><select
          id="alignSelect"
          :value="editorOptions.align"
          @change="emit('update:editorOption', 'align', $event.target.value)"
        >
          <option
            v-for="align in ALIGN_OPTIONS"
            :key="align.value"
            :value="align.value"
          >
            {{ align.label }}
          </option>
        </select>
      </div>
      <div class="design-field">
        <span class="design-label">표시 옵션</span>
        <div class="display-options">
          <button
            type="button"
            class="format-toggle"
            :class="{ active: editorOptions.bold }"
            :aria-pressed="editorOptions.bold"
            @click="emit('toggle-option', 'bold')"
          >
            굵게</button
          ><button
            type="button"
            class="format-toggle"
            :class="{ active: editorOptions.hideColon }"
            :aria-pressed="editorOptions.hideColon"
            @click="emit('toggle-option', 'hideColon')"
          >
            : 제거
          </button>
        </div>
      </div>
    </div>
    <div
      class="template-thumbnails"
      role="group"
      aria-label="템플릿 미리보기 선택"
    >
      <button
        v-for="template in templateOptions"
        :key="template.value"
        type="button"
        :aria-label="template.label + ' 미리보기'"
        :aria-pressed="selectedTemplate === template.value"
        @click="emit('update:selectedTemplate', template.value)"
      >
        <img
          :src="
            '/images/schedule/thumbs/' +
            template.value.split('/').at(-1).replace('.png', '.webp')
          "
          alt=""
          loading="lazy"
          decoding="async"
          width="224"
          height="126"
        /><span>{{ template.label }}</span>
      </button>
    </div>
    <div class="schedule-reset-actions">
      <button type="button" @click="emit('reset-schedule')">내용 초기화</button
      ><span aria-hidden="true">·</span
      ><button type="button" @click="emit('reset-all')">전체 초기화</button>
    </div>
  </fieldset>
</template>
<style scoped>
.schedule-editor-tools {
  min-width: 0;
  width: 100%;
  padding: 24px;
  margin: 0 0 16px;
  color: #21382c;
}
.editor-tools-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 22px;
}
.editor-tools-heading .eyebrow {
  font-size: 10px;
  margin-bottom: 7px;
}
.editor-tools-heading h2 {
  font-size: 20px;
  letter-spacing: -0.6px;
  margin: 0;
}
.output-size {
  background: #f0f5eb;
  border: 1px solid #e0e9da;
  border-radius: 7px;
  padding: 6px 10px;
  font-size: 11px;
  white-space: nowrap;
  color: #58724d;
}
.editor-design-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 20px;
}
.design-field {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}
.design-field label,
.design-label {
  font-size: 12px;
  font-weight: 700;
  color: #4b5c50;
}
.design-field select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border: 1px solid #dfe7dd;
  border-radius: 9px;
  background: #fbfcfa;
  color: #374a3c;
  padding: 0 13px;
  font-size: 13px;
}
.design-field-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.design-field output {
  font-size: 11px;
  color: #627460;
}
.range-control {
  display: flex;
  align-items: center;
  height: 44px;
  background: #fbfcfa;
  border: 1px solid #dfe7dd;
  border-radius: 9px;
  padding: 0 13px;
}
.range-control input {
  width: 100%;
  min-width: 0;
  accent-color: #609c48;
  margin: 0;
}
.color-control {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fbfcfa;
  min-height: 44px;
  border: 1px solid #dfe7dd;
  border-radius: 9px;
  padding: 5px 11px;
}
.color-control input {
  width: 34px;
  height: 30px;
  flex: 0 0 34px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.color-control > span {
  font-size: 11px;
  color: #627460;
}
.display-options {
  display: flex;
  gap: 8px;
}
.format-toggle {
  min-height: 44px;
  flex: 1;
  border: 1px solid #dfe7dd;
  border-radius: 9px;
  background: #fff;
  color: #627460;
  font-size: 12px;
  font-weight: 700;
  padding: 0 12px;
  white-space: nowrap;
}
.format-toggle.active {
  border-color: #c9e3b6;
  background: #e5f3d9;
  color: #366a3d;
}
.schedule-tools-actions {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  border-top: 1px solid #e8ede4;
  margin-top: 24px;
  padding-top: 22px;
}
.server-actions,
.image-downloads {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;
}
.schedule-tools-actions .btn {
  min-height: 43px;
  font-size: 12px;
  padding: 0 16px;
}
.image-downloads > span {
  font-size: 11px;
  color: #627460;
  margin-right: 3px;
}
.btn-lime {
  background: #ccebaa;
  border-color: #c4e69f;
  color: #24472c;
}
.btn-lime:hover {
  background: #bedf9c;
}
.schedule-reset-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 17px;
  color: #a7b0a3;
}
.schedule-reset-actions button {
  border: 0;
  background: none;
  color: #866b60;
  padding: 4px 0;
  font-size: 11px;
}
.schedule-reset-actions button:hover {
  color: #a34740;
  text-decoration: underline;
}
.schedule-editor-tools:disabled {
  opacity: 0.65;
}
.schedule-editor-tools:disabled button {
  cursor: wait;
}
@media (max-width: 640px) {
  .schedule-editor-tools {
    padding: 18px;
  }
  .editor-tools-heading {
    gap: 10px;
    margin-bottom: 20px;
  }
  .editor-tools-heading h2 {
    font-size: 19px;
  }
  .output-size {
    font-size: 10px;
    padding: 5px 7px;
  }
  .editor-design-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 17px 13px;
  }
  .template-field {
    grid-column: 1/-1;
  }
  .editor-design-grid > .design-field:last-child {
    grid-column: 1/-1;
  }
  .display-options {
    max-width: 250px;
  }
  .color-control {
    gap: 6px;
    padding: 5px 7px;
  }
  .color-control > span {
    font-size: 10px;
  }
  .schedule-tools-actions {
    gap: 18px;
    align-items: stretch;
    margin-top: 20px;
    padding-top: 18px;
  }
  .server-actions,
  .image-downloads {
    width: 100%;
    gap: 8px;
  }
  .server-actions .btn:first-child {
    flex: 1;
  }
  .server-actions .btn:last-child {
    flex: 1.5;
  }
  .schedule-tools-actions .btn {
    padding: 0 10px;
    font-size: 11px;
  }
  .image-downloads > span {
    width: 100%;
    margin: 0;
  }
  .image-downloads .btn {
    flex: 1;
  }
  .schedule-reset-actions {
    margin-top: 13px;
  }
}
.template-thumbnails {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 20px;
}
.template-thumbnails button {
  padding: 5px;
  min-width: 0;
  background: #fff;
  border: 1px solid #dfe7dd;
  border-radius: 9px;
  color: #4b6545;
  font-size: 11px;
}
.template-thumbnails button[aria-pressed="true"] {
  border: 2px solid #6b9b4e;
  background: #f1f9e9;
}
.template-thumbnails img {
  width: 100%;
  height: auto;
  border-radius: 5px;
  display: block;
}
.template-thumbnails span {
  display: block;
  padding: 6px 0 1px;
}
</style>
