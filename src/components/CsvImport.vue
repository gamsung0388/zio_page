<script setup>
import { downloadBlob } from "../services/api.js";
import { useCsvImport } from "../services/useCsvImport.js";
import { SONG_FIELDS } from "../../shared/song-rules.js";
import Modal from "./Modal.vue";
import Icon from "./Icon.vue";
const emit = defineEmits(["close", "imported"]);
const {
  file,
  preview,
  error,
  busy,
  acknowledged,
  storageNotice,
  selectFile,
  send,
} = useCsvImport((message) => emit("imported", message));
function template() {
  downloadBlob(
    new Blob(["\uFEFF" + SONG_FIELDS.join(",") + "\r\n"], {
      type: "text/csv;charset=utf-8",
    }),
    "zio-songs-template.csv",
  );
}
</script>
<template>
  <Modal title="CSV 일괄 등록" wide :busy="busy" @close="emit('close')"
    ><p class="modal-intro">
      UTF-8 CSV · 최대 1MB / 1,000곡. 모든 행이 유효할 때 한 번에 추가합니다.
      기존 곡은 덮어쓰지 않습니다.
    </p>
    <div class="csv-upload">
      <Icon name="upload" :size="28" /><label class="field"
        >CSV 파일 선택<input
          type="file"
          accept=".csv,text/csv"
          :disabled="busy"
          @change="selectFile" /></label
      ><button class="text-button small" :disabled="busy" @click="template">
        <Icon name="download" :size="15" />빈 템플릿 다운로드
      </button>
    </div>
    <p v-if="storageNotice" class="form-hint" role="status">
      {{ storageNotice }}
    </p>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <button
      v-if="file && !preview"
      class="button primary"
      :disabled="busy"
      @click="send(false)"
    >
      {{ busy ? "검증 중…" : "미리보기 및 검증" }}
    </button>
    <section v-if="preview" class="csv-preview">
      <h3>
        총 {{ preview.total }}곡 · 정상 {{ preview.rows.length }}곡 · 오류
        {{ preview.errors.length }}건
      </h3>
      <div v-if="preview.errors.length" class="form-error" role="alert">
        <p>오류를 수정한 후 파일을 다시 선택해주세요.</p>
        <ul>
          <li
            v-for="(item, index) in preview.errors.slice(0, 100)"
            :key="index"
          >
            {{ item.row }}행 {{ item.field }}: {{ item.message }}
          </li>
        </ul>
        <p v-if="preview.errors.length > 100">
          오류는 처음 100건까지 표시합니다.
        </p>
      </div>
      <div v-if="preview.warnings.length" class="csv-warnings">
        <strong>중복 경고 {{ preview.warnings.length }}건</strong>
        <ul>
          <li
            v-for="(item, index) in preview.warnings.slice(0, 20)"
            :key="index"
          >
            {{ item.row }}행: {{ item.message }}
          </li>
        </ul>
        <p v-if="preview.warnings.length > 20">
          처음 20건의 경고를 표시합니다.
        </p>
        <label class="checkbox-label"
          ><input v-model="acknowledged" type="checkbox" :disabled="busy" />중복
          곡도 새로운 곡으로 추가하는 것에 동의합니다.</label
        >
      </div>
      <div v-if="preview.rows.length" class="csv-table-wrap">
        <table>
          <thead>
            <tr>
              <th>행</th>
              <th>곡명</th>
              <th>가수</th>
              <th>숙련도</th>
              <th>풍</th>
              <th>공개</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in preview.rows.slice(0, 20)" :key="item.row">
              <td>{{ item.row }}</td>
              <td>{{ item.song.title }}</td>
              <td>{{ item.song.artist }}</td>
              <td>{{ item.song.proficiency }}</td>
              <td>{{ item.song.balloon_cost }}</td>
              <td>{{ item.song.is_public ? "공개" : "비공개" }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="preview.rows.length > 20" class="form-hint">
        미리보기는 처음 20곡까지 표시합니다. 전체 {{ preview.total }}곡을
        검증했습니다.
      </p>
    </section>
    <div class="modal-actions">
      <button class="button secondary" :disabled="busy" @click="emit('close')">
        닫기</button
      ><button
        v-if="preview"
        class="button primary"
        :disabled="
          busy ||
          !preview.can_import ||
          (preview.warnings.length > 0 && !acknowledged)
        "
        @click="send(true)"
      >
        {{ busy ? "추가 중…" : `${preview.total}곡 추가하기` }}
      </button>
    </div></Modal
  >
</template>
