<script setup>
import "../styles/song-image.css";
import { ref, onBeforeUnmount } from "vue";
import { prepareSongImage } from "../services/song-image.js";
const props = defineProps({
  modelValue: { type: String, default: null },
  disabled: Boolean,
});
const emit = defineEmits(["update:modelValue", "processing"]);
const busy = ref(false),
  error = ref("");
let alive = true;
onBeforeUnmount(() => {
  alive = false;
});
async function choose(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file || busy.value || props.disabled) return;
  error.value = "";
  busy.value = true;
  emit("processing", true);
  try {
    const image = await prepareSongImage(file);
    if (alive) emit("update:modelValue", image);
  } catch (e) {
    if (alive) error.value = e.message;
  } finally {
    if (alive) {
      busy.value = false;
      emit("processing", false);
    }
  }
}
</script>
<template>
  <section
    class="song-cover-editor"
    aria-label="앨범 사진 등록"
    :aria-busy="busy"
  >
    <div class="field-heading">
      <h2>앨범 사진</h2>
      <span class="help-text">선택 사항</span>
    </div>
    <div class="song-cover-upload">
      <img
        v-if="modelValue"
        :src="modelValue"
        alt="선택한 앨범 사진"
        width="112"
        height="112"
      />
      <div class="song-cover-upload-controls">
        <label class="field"
          >{{ modelValue ? "사진 변경" : "사진 선택"
          }}<input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            :disabled="disabled || busy"
            @change="choose"
        /></label>
        <button
          v-if="modelValue"
          type="button"
          class="button secondary"
          :disabled="disabled || busy"
          @click="
            error = '';
            emit('update:modelValue', null);
          "
        >
          사진 삭제
        </button>
        <p class="help-text">
          JPG · PNG · WEBP / 최대 10MB. 작은 표지로 자동 저장돼요.
        </p>
        <p class="help-text">
          {{
            busy
              ? "사진을 준비하고 있어요…"
              : "사진 변경·삭제는 노래를 저장하면 반영돼요."
          }}
        </p>
      </div>
    </div>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
  </section>
</template>
