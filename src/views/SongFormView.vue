<script setup>
import { computed, reactive, ref, watch } from "vue";
import LeafRating from "../components/LeafRating.vue";
import StatusPill from "../components/StatusPill.vue";
import { validateDraft } from "../services/song-adapter.js";
import DraftRecovery from "../components/DraftRecovery.vue";
import { isSongDraft } from "../services/song-draft.js";
import { useEditorDraft } from "../services/useEditorDraft.js";
import CoverImage from "../components/CoverImage.vue";
const genres = ["가요", "발라드", "팝", "애니", "재즈", "기타"];
const statuses = ["미연습", "연습중", "완료", "잠시 보류"];

const props = defineProps({
  song: { type: Object, default: null },
  connected: Boolean,
  saveAction: Function,
  draftScope: { type: String, default: "" },
});
const emit = defineEmits(["save", "cancel"]);
const isEdit = computed(() => Boolean(props.song?.id));
const busy = ref(false);
const error = ref("");
const baseline = ref("");
const dirty = computed(() => JSON.stringify(form) !== baseline.value);
function markSaved() {
  baseline.value = JSON.stringify(form);
}
const form = reactive({
  title: "",
  artist: "",
  genre: "가요",
  level: 0,
  practiceStatus: "미연습",
  balloonCount: 0,
  cover: "",
  description: "",
  privateMemo: "",
  language: "",
  isPublic: true,
  links: [],
});

function reset() {
  const song = props.song;
  Object.assign(form, {
    title: song?.title ?? "",
    artist: song?.artist ?? "",
    genre: song?.genre ?? "가요",
    level: song?.level ?? 0,
    practiceStatus: song?.practiceStatus ?? "미연습",
    balloonCount: song?.balloonCount ?? 0,
    cover: song?.cover ?? "",
    description: song?.description ?? "",
    privateMemo: song?.privateMemo ?? "",
    language: song?.language ?? "",
    isPublic: song?.isPublic ?? true,
    links: song?.links?.map((link) => ({ ...link })) ?? [],
  });
  error.value = "";
  markSaved();
}
watch(() => props.song, reset, { immediate: true });
const drafts = useEditorDraft({
  scope: computed(() => props.draftScope),
  ready: computed(() => props.connected),
  dirty,
  enabled: props.connected,
  snapshot: () => ({
    ...form,
    links: form.links.map((link) => ({ ...link })),
    sourceUpdatedAt: props.song?.updatedAt || null,
  }),
  validate: isSongDraft,
  apply(value) {
    if (
      isEdit.value &&
      value.sourceUpdatedAt !== (props.song?.updatedAt || null) &&
      !window.confirm(
        "저장된 노래가 초안 작성 후 변경되었어요. 이 초안을 복구하고 내용을 비교할까요?",
      )
    )
      return false;
    for (const key of Object.keys(form)) form[key] = value[key];
  },
});
const { pending, storageError } = drafts;
function saved() {
  markSaved();
  drafts.clear();
}
defineExpose({ dirty, busy, markSaved: saved, discardDraft: drafts.clear });

const previewSong = computed(() => ({
  title: form.title.trim() || "곡 제목을 입력해주세요",
  artist: form.artist.trim() || "아티스트",
  genre: form.genre,
  level: Number(form.level),
  practiceStatus: form.practiceStatus,
  balloonCount: Number(form.balloonCount),
  cover: form.cover || "/images/covers/night.svg",
}));

function onFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    error.value = "JPG, PNG, WEBP 이미지만 선택할 수 있어요.";
    event.target.value = "";
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    error.value = "UI 데모에서는 3MB 이하 이미지만 사용할 수 있어요.";
    event.target.value = "";
    return;
  }
  error.value = "";
  const reader = new FileReader();
  reader.onload = () => {
    form.cover = String(reader.result || "");
  };
  reader.readAsDataURL(file);
}

function addLink() {
  form.links.push({ label: "YouTube", url: "" });
}
function removeLink(index) {
  form.links.splice(index, 1);
}

async function submit() {
  if (busy.value) return;
  error.value = "";
  const errors = validateDraft(form);
  if (errors.length) {
    error.value = errors[0];
    return;
  }
  const cleanLinks = form.links
    .filter((link) => link.url.trim())
    .map((link) => ({
      label: link.label.trim() || "관련 링크",
      url: link.url.trim(),
    }));
  if (cleanLinks.some((link) => !/^https?:\/\/\S+$/i.test(link.url))) {
    error.value = "관련 링크는 https:// 또는 http:// 주소만 사용할 수 있어요.";
    return;
  }
  const payload = {
    title: form.title.trim(),
    artist: form.artist.trim(),
    genre: form.genre,
    level: Number(form.level),
    practiceStatus: form.practiceStatus,
    balloonCount: Number(form.balloonCount),
    cover: form.cover || "/images/covers/night.svg",
    description: form.description.trim(),
    privateMemo: form.privateMemo.trim(),
    language: form.language.trim(),
    isPublic: form.isPublic,
    links: cleanLinks,
  };
  busy.value = true;
  try {
    if (props.saveAction) await props.saveAction(payload);
    else emit("save", payload);
  } catch (err) {
    error.value = err.message || "저장하지 못했어요. 다시 시도해주세요.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page-toolbar">
    <button
      type="button"
      class="back-link"
      :disabled="busy"
      @click="emit('cancel')"
    >
      ← 목록으로 돌아가기</button
    ><span class="toolbar-trail"
      >노래책자 / {{ isEdit ? "수정" : "등록" }}</span
    >
  </div>
  <section class="page-intro form-intro">
    <div>
      <span class="eyebrow">SONGBOOK EDITOR</span>
      <h1>
        {{ isEdit ? "노래 정보 수정" : "새 노래 등록" }}
        <span class="heading-sprout">✿</span>
      </h1>
      <p>
        {{
          isEdit
            ? "등록한 곡의 정보를 다듬어주세요."
            : "지오의 노래책자에 새로운 곡을 추가해보세요."
        }}
      </p>
    </div>
  </section>
  <DraftRecovery
    :pending="pending"
    :error="storageError"
    @restore="drafts.restore"
    @discard="drafts.clear"
  />
  <div class="form-layout">
    <form
      class="card song-form"
      aria-label="노래 입력"
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <fieldset class="editor-fields" :disabled="busy">
        <div class="form-section-heading">
          <h2>기본 정보</h2>
          <span><b>*</b> 필수 입력 항목</span>
        </div>
        <div class="form-grid">
          <label class="field"
            ><span>곡명 <b>*</b></span
            ><input
              v-model="form.title"
              required
              maxlength="200"
              placeholder="노래 제목을 입력하세요"
          /></label>
          <label class="field"
            ><span>아티스트 <b>*</b></span
            ><input
              v-model="form.artist"
              required
              maxlength="200"
              placeholder="가수 또는 아티스트명"
          /></label>
          <label class="field"
            ><span>장르</span
            ><input
              v-model="form.genre"
              list="preview-genres"
              maxlength="60"
              placeholder="장르를 선택하거나 입력하세요" /><datalist
              id="preview-genres"
            >
              <option
                v-for="item in genres.filter((v) => v !== '전체')"
                :key="item"
                :value="item"
              /></datalist
          ></label>
          <label class="field"
            ><span>신청 풍 개수 <b>*</b></span
            ><input
              v-model.number="form.balloonCount"
              type="number"
              min="0"
              step="1"
              required
          /></label>
        </div>
        <div class="form-grid form-extra">
          <label class="field"
            ><span>언어</span
            ><input
              v-model="form.language"
              maxlength="40"
              placeholder="예: 한국어" /></label
          ><label class="field"
            ><span>공개 상태</span
            ><select v-model="form.isPublic" aria-label="공개 상태">
              <option :value="true">공개</option>
              <option :value="false">비공개</option>
            </select></label
          >
        </div>
        <div class="form-divider"></div>
        <div class="form-grid">
          <div class="field">
            <span>숙련도 <b>*</b></span>
            <div class="rating-input">
              <LeafRating
                :value="Number(form.level)"
                editable
                showNumber
                @change="form.level = $event"
              />
              <p>잎사귀를 눌러 1~5단계를 선택하세요.</p>
            </div>
          </div>
          <fieldset class="field">
            <legend>연습 상태 <b>*</b></legend>
            <div class="segment-group">
              <label
                v-for="status in statuses"
                :key="status"
                :class="{ selected: form.practiceStatus === status }"
                ><input
                  v-model="form.practiceStatus"
                  type="radio"
                  name="practiceStatus"
                  :value="status"
                /><span>{{ status }}</span></label
              >
            </div>
          </fieldset>
        </div>
        <div class="form-divider"></div>
        <label class="field full-width"
          ><span>곡 설명</span
          ><textarea
            v-model="form.description"
            maxlength="5000"
            rows="4"
            placeholder="곡의 분위기나 소개를 적어주세요."
          ></textarea
          ><small class="field-count"
            >{{ form.description.length }} / 5000</small
          ></label
        >
        <label class="field full-width"
          ><span
            >지오 메모
            <small class="private-indicator">관리자 전용</small></span
          ><textarea
            v-model="form.privateMemo"
            maxlength="3000"
            rows="3"
            placeholder="연습 포인트나 내부 메모를 적어주세요."
          ></textarea
          ><small class="field-count"
            >{{ form.privateMemo.length }} / 3000</small
          ></label
        >
        <div v-if="!connected" class="form-divider"></div>
        <label v-if="!connected" class="field full-width"
          ><span>커버 이미지</span
          ><span class="upload-box"
            ><span class="upload-icon">▧</span
            ><strong>{{
              form.cover ? "이미지 변경하기" : "이미지 선택하기"
            }}</strong
            ><small>JPG · PNG · WEBP / 최대 3MB (UI 데모)</small
            ><input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="onFileChange" /></span
        ></label>
        <div v-if="!connected" class="field full-width">
          <div class="field-heading">
            <span>관련 링크</span
            ><button type="button" class="small-add-button" @click="addLink">
              ＋ 링크 추가
            </button>
          </div>
          <div
            v-for="(link, index) in form.links"
            :key="index"
            class="link-input-row"
          >
            <label
              ><span class="sr-only">링크 종류</span
              ><select v-model="link.label">
                <option>YouTube</option>
                <option>원곡</option>
                <option>기타</option>
              </select></label
            ><label class="link-grow"
              ><span class="sr-only">링크 주소</span
              ><input
                v-model="link.url"
                type="url"
                placeholder="https://..." /></label
            ><button
              class="remove-link"
              type="button"
              :aria-label="`${index + 1}번째 링크 제거`"
              @click="removeLink(index)"
            >
              ×
            </button>
          </div>
          <p v-if="form.links.length === 0" class="help-text">
            필요한 경우 영상·원곡 링크를 추가할 수 있어요.
          </p>
        </div>
      </fieldset>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <button
          class="btn btn-outline"
          type="button"
          :disabled="busy"
          @click="emit('cancel')"
        >
          취소</button
        ><button class="btn btn-primary" type="submit" :disabled="busy">
          {{ busy ? "저장 중…" : isEdit ? "수정하기" : "등록하기" }}
        </button>
      </div>
    </form>
    <aside class="form-aside" :class="{ connected }">
      <div class="card preview-panel">
        <span class="eyebrow">LIVE PREVIEW</span>
        <h2>미리보기</h2>
        <div class="preview-cover-row">
          <CoverImage :src="previewSong.cover" alt="등록 이미지 미리보기" />
          <div>
            <h3>{{ previewSong.title }}</h3>
            <p>{{ previewSong.artist }}</p>
            <span class="genre-chip">{{ previewSong.genre }}</span>
          </div>
        </div>
        <div class="preview-stat">
          <span>숙련도</span
          ><LeafRating :value="previewSong.level" showNumber />
        </div>
        <div class="preview-stat">
          <span>연습 상태</span
          ><StatusPill :status="previewSong.practiceStatus" />
        </div>
        <div class="preview-stat">
          <span>신청 풍 개수</span
          ><strong>🍃 {{ previewSong.balloonCount }}개</strong>
        </div>
        <p class="preview-desc">
          {{
            form.description || "곡 설명을 입력하면 이곳에서 미리 볼 수 있어요."
          }}
        </p>
      </div>
      <div v-if="!connected" class="form-tip">
        <span>♡ ZIO TIP</span>
        <p>
          필요한 정보를 간단하게 등록해보세요.
          <strong>지금은 UI 시연용</strong>이라 저장한 내용이 서버에 남지 않고
          새로고침 시 초기화됩니다.
        </p>
        <img src="/images/zio-reference.png" alt="지오" />
      </div>
    </aside>
  </div>
</template>
