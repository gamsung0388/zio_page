<script setup>
import { ref } from "vue";
import { api } from "../services/api.js";
import { PRACTICE_OPTIONS } from "../../shared/song-rules.js";
import Modal from "./Modal.vue";
const props = defineProps({ items: { type: Array, required: true } }),
  emit = defineEmits(["close", "saved", "busy"]);
const field = ref("practice_status"),
  value = ref("practicing"),
  busy = ref(false),
  error = ref("");
function change() {
  value.value = {
    practice_status: "practicing",
    proficiency: "3",
    balloon_cost: "0",
    is_public: "false",
  }[field.value];
}
async function save() {
  if (busy.value) return;
  busy.value = true;
  emit("busy", true);
  error.value = "";
  try {
    let selected = value.value;
    if (field.value === "is_public") selected = selected === "true";
    else if (field.value !== "practice_status") selected = Number(selected);
    const result = await api("/admin/songs/bulk", {
      method: "PATCH",
      body: {
        items: props.items.map((song) => ({
          id: song.id,
          expected_revision: song.revision,
        })),
        changes: { [field.value]: selected },
      },
    });
    emit("saved", result);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
    emit("busy", false);
  }
}
</script>
<template>
  <Modal title="선택한 노래 일괄 수정" :busy="busy" @close="emit('close')"
    ><p class="modal-intro">
      선택한 {{ items.length }}곡에서 아래 항목만 바꿔요. 다른 곳에서 수정된
      곡은 건너뛰고 결과를 알려드립니다.
    </p>
    <form aria-label="노래 일괄 수정" @submit.prevent="save">
      <fieldset class="editor-fields" :disabled="busy">
        <label class="field"
          >변경할 항목<select v-model="field" @change="change">
            <option value="practice_status">연습 상태</option>
            <option value="proficiency">숙련도</option>
            <option value="balloon_cost">신청 풍 개수</option>
            <option value="is_public">공개 여부</option>
          </select></label
        ><label class="field"
          >변경할 값<select v-if="field === 'practice_status'" v-model="value">
            <option
              v-for="option in PRACTICE_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option></select
          ><select v-else-if="field === 'proficiency'" v-model="value">
            <option v-for="n in 5" :key="n" :value="String(n)">
              {{ n }}단계
            </option></select
          ><select v-else-if="field === 'is_public'" v-model="value">
            <option value="true">공개</option>
            <option value="false">비공개</option></select
          ><input
            v-else
            v-model="value"
            type="number"
            min="0"
            step="1"
            required
        /></label>
      </fieldset>
      <p v-if="field === 'is_public' && value === 'true'" class="help-text">
        저장하면 선택한 곡이 방문자 노래책자에 공개됩니다.
      </p>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="busy"
          @click="emit('close')"
        >
          취소</button
        ><button class="button primary" :disabled="busy">
          {{ busy ? "변경 중…" : items.length + "곡 변경하기" }}
        </button>
      </div>
    </form></Modal
  >
</template>
