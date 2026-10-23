<script setup>
import { ref, toRaw } from "vue";
import { useRouter } from "vue-router";
import {
  readSongBackup,
  SONG_BACKUP_MAX_BYTES,
} from "../../shared/song-backup.js";
import { stagedSongBackup } from "../services/song-backup.js";
import Modal from "./Modal.vue";
const emit = defineEmits(["close"]),
  router = useRouter(),
  songs = ref([]),
  error = ref(""),
  index = ref(0),
  busy = ref(false);
async function read(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  busy.value = true;
  error.value = "";
  songs.value = [];
  try {
    if (file.size > SONG_BACKUP_MAX_BYTES)
      throw Error("64MB 이하 JSON 백업을 선택해주세요.");
    songs.value = readSongBackup(JSON.parse(await file.text()));
    index.value = 0;
    if (!songs.value.length) throw Error("백업에 등록된 노래가 없어요.");
  } catch (e) {
    error.value =
      e instanceof SyntaxError ? "JSON 파일 형식을 확인해주세요." : e.message;
  } finally {
    busy.value = false;
    event.target.value = "";
  }
}
function choose() {
  stagedSongBackup.value = structuredClone(toRaw(songs.value[index.value]));
  emit("close");
  router.push("/admin/songs/new?backup=1");
}
</script>
<template>
  <Modal title="백업에서 노래 가져오기" :busy="busy" @close="emit('close')"
    ><p class="modal-intro">
      앨범 사진·연결 정보를 포함한 JSON 백업에서 한 곡을 골라 새 등록 화면으로
      가져와요. 확인 후 저장해야 등록되며 기존 곡을 덮어쓰지 않습니다.
    </p>
    <label class="field"
      >노래 JSON 백업 파일<input
        type="file"
        accept=".json,application/json"
        :disabled="busy"
        @change="read"
    /></label>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <label v-if="songs.length" class="field"
      >가져올 곡<select v-model.number="index">
        <option v-for="(song, n) in songs" :key="n" :value="n">
          {{ song.title }} · {{ song.artist }}
        </option>
      </select></label
    >
    <p v-if="songs.length" class="help-text">
      관리자 메모와 앨범 사진·연결을 유지하며 비공개 상태로 준비해요.
    </p>
    <div class="modal-actions">
      <button
        type="button"
        class="button secondary"
        :disabled="busy"
        @click="emit('close')"
      >
        취소</button
      ><button
        type="button"
        class="button primary"
        :disabled="busy || !songs.length"
        @click="choose"
      >
        등록 화면에서 확인
      </button>
    </div></Modal
  >
</template>
