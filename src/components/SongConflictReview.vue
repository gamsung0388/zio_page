<script setup>
import { computed, ref } from "vue";
import Modal from "./Modal.vue";
import {
  songReviewRows,
  mergeSongReview,
  songReviewValue,
} from "../services/song-review.js";
const props = defineProps({ base: Object, draft: Object, latest: Object });
const emit = defineEmits(["close", "apply"]);
const rows = ref(songReviewRows(props.base, props.draft, props.latest));
const unresolved = computed(() => rows.value.some((row) => !row.selection));
function apply() {
  emit("apply", mergeSongReview(props.draft, props.latest, rows.value));
}
</script>
<template>
  <Modal title="저장된 노래와 내 입력 비교" wide @close="emit('close')">
    <p class="modal-intro">
      내 입력을 유지한 채 최신 저장 내용과 비교합니다. 양쪽에서 바뀐 항목은
      사용할 내용을 골라주세요. 적용 후에도 저장 버튼을 눌러야 반영됩니다.
    </p>
    <p v-if="!rows.length">
      현재 저장된 내용과 내 입력이 같아요. 최신 버전으로 편집을 계속할 수
      있습니다.
    </p>
    <div class="song-review-fields">
      <fieldset
        v-for="row in rows"
        :key="row.key"
        :class="{ 'has-conflict': row.conflict }"
      >
        <legend>
          {{ row.label }}
          <small v-if="row.conflict">양쪽에서 변경됨 · 선택 필요</small>
        </legend>
        <label
          ><input
            v-model="row.selection"
            type="radio"
            :name="'review-' + row.key"
            value="latest"
            :aria-label="row.label + ' 저장된 내용 사용'"
          /><span
            ><b>저장된 내용</b
            ><img
              v-if="row.key === 'coverImage' && row.latest"
              :src="row.latest"
              alt="저장된 앨범 사진"
              width="80"
              height="80"
            /><span>{{ songReviewValue(row.latest) }}</span></span
          ></label
        >
        <label
          ><input
            v-model="row.selection"
            type="radio"
            :name="'review-' + row.key"
            value="mine"
            :aria-label="row.label + ' 내 입력 사용'"
          /><span
            ><b>내 입력</b
            ><img
              v-if="row.key === 'coverImage' && row.mine"
              :src="row.mine"
              alt="내가 선택한 앨범 사진"
              width="80"
              height="80"
            /><span>{{ songReviewValue(row.mine) }}</span></span
          ></label
        >
      </fieldset>
    </div>
    <p v-if="unresolved" role="status">
      양쪽에서 바뀐 항목의 선택을 완료해주세요.
    </p>
    <div class="modal-actions">
      <button class="button secondary" @click="emit('close')">
        내 입력으로 돌아가기</button
      ><button class="button primary" :disabled="unresolved" @click="apply">
        선택한 내용으로 편집 계속
      </button>
    </div>
  </Modal>
</template>
<style scoped>
.song-review-fields {
  display: grid;
  gap: 16px;
  margin: 20px 0;
}
fieldset {
  min-width: 0;
  border: 1px solid #dfe6dc;
  border-radius: 12px;
  padding: 12px;
}
legend {
  font-weight: 700;
  padding: 0 6px;
}
legend small {
  display: block;
  color: #865423;
  font-weight: 400;
}
.has-conflict {
  border-color: #bd945f;
}
label {
  display: flex;
  gap: 10px;
  padding: 10px 4px;
  align-items: flex-start;
  cursor: pointer;
}
label > span {
  display: grid;
  gap: 4px;
  min-width: 0;
}
label span span {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 180px;
  overflow: auto;
}
input {
  margin-top: 5px;
  flex: none;
}
</style>
