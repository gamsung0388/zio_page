<script setup>
import { reactive, ref, useId } from "vue";
import { api } from "../services/api.js";
import { updateAdminSong } from "../services/song-admin.js";
import { proficiencyLabels, practiceLabels } from "../services/song-labels.js";
import Modal from "./Modal.vue";
const props = defineProps({ song: Object });
const emit = defineEmits(["close", "saved"]);
const prefix = useId();
const defaults = {
  title: "",
  artist: "",
  description: "",
  genre: "",
  language: "",
  proficiency: 1,
  practice_status: "not_started",
  balloon_cost: 0,
  memo: "",
  is_public: true,
};
const draft = reactive(
  Object.fromEntries(
    Object.entries(defaults).map(([key, value]) => [
      key,
      props.song?.[key] ?? value,
    ]),
  ),
);
const busy = ref(false),
  error = ref(""),
  details = ref([]);
async function save() {
  busy.value = true;
  error.value = "";
  details.value = [];
  try {
    if (props.song)
      await updateAdminSong(props.song.id, props.song.revision, { ...draft });
    else await api("/admin/songs", { method: "POST", body: { ...draft } });
    emit(
      "saved",
      props.song ? "노래를 수정했습니다." : "새 노래를 등록했습니다.",
    );
  } catch (err) {
    error.value = err.message;
    details.value = err.details;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal
    :title="song ? '노래 수정' : '새 노래 등록'"
    :busy="busy"
    wide
    @close="emit('close')"
  >
    <form class="song-form" @submit.prevent="save">
      <fieldset :disabled="busy">
        <div class="form-grid">
          <div class="field">
            <label :for="`${prefix}-title`"
              >곡명 <span class="required" aria-hidden="true">*</span></label
            ><input
              :id="`${prefix}-title`"
              v-model="draft.title"
              maxlength="200"
              required
              autofocus
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-artist`"
              >가수 <span class="required" aria-hidden="true">*</span></label
            ><input
              :id="`${prefix}-artist`"
              v-model="draft.artist"
              maxlength="200"
              required
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-genre`">장르</label
            ><input
              :id="`${prefix}-genre`"
              v-model="draft.genre"
              maxlength="60"
              placeholder="예: 발라드"
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-language`">언어</label
            ><input
              :id="`${prefix}-language`"
              v-model="draft.language"
              maxlength="40"
              placeholder="예: 한국어"
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-proficiency`">숙련도</label
            ><select
              :id="`${prefix}-proficiency`"
              v-model.number="draft.proficiency"
            >
              <option v-for="n in 5" :key="n" :value="n">
                {{ n }}단계 · {{ proficiencyLabels[n] }}
              </option>
            </select>
          </div>
          <div class="field">
            <label :for="`${prefix}-status`">연습 상태</label
            ><select :id="`${prefix}-status`" v-model="draft.practice_status">
              <option
                v-for="(label, value) in practiceLabels"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </div>
          <div class="field">
            <label :for="`${prefix}-cost`">신청 필요 풍 개수</label
            ><input
              :id="`${prefix}-cost`"
              v-model.number="draft.balloon_cost"
              type="number"
              min="0"
              max="9007199254740991"
              step="1"
              required
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-public`">공개 상태</label
            ><select :id="`${prefix}-public`" v-model="draft.is_public">
              <option :value="true">공개</option>
              <option :value="false">비공개</option>
            </select>
          </div>
        </div>
        <p class="form-hint">
          숙련도와 연습 상태는 서로 독립적으로 저장됩니다.
        </p>
        <div class="field">
          <label :for="`${prefix}-description`">곡 설명</label
          ><textarea
            :id="`${prefix}-description`"
            v-model="draft.description"
            rows="3"
            maxlength="5000"
            :aria-describedby="`${prefix}-description-hint`"
          ></textarea
          ><small :id="`${prefix}-description-hint`"
            >{{ draft.description.length }} / 5,000</small
          >
        </div>
        <div class="field">
          <label :for="`${prefix}-memo`"
            >관리자 메모
            <span class="private-label" aria-hidden="true">비공개</span></label
          ><textarea
            :id="`${prefix}-memo`"
            v-model="draft.memo"
            rows="2"
            maxlength="3000"
            :aria-describedby="`${prefix}-memo-hint`"
          ></textarea
          ><small :id="`${prefix}-memo-hint`"
            >공개 페이지에는 표시되지 않습니다. {{ draft.memo.length }} /
            3,000</small
          >
        </div>
      </fieldset>
      <div v-if="error" class="form-error" role="alert">
        <p>{{ error }}</p>
        <ul v-if="details.length">
          <li v-for="(detail, index) in details" :key="index">
            {{ detail.message }}
          </li>
        </ul>
      </div>
      <div class="modal-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="busy"
          @click="emit('close')"
        >
          취소</button
        ><button class="button primary" :disabled="busy">
          {{ busy ? "저장 중…" : "저장하기" }}
        </button>
      </div>
    </form>
  </Modal>
</template>
