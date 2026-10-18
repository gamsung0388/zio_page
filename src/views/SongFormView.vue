<script setup>
import FieldLabel from "../components/FieldLabel.vue";
import HelpTooltip from "../components/HelpTooltip.vue";
import SongSaveVisibility from "../components/SongSaveVisibility.vue";
import { SONG_TEXT_FIELDS, PRACTICE_OPTIONS } from "../../shared/song-rules.js";
import { SONG_FIELD_HELP } from "../services/song-form-info.js";
import "../styles/song-editor.css";
import { computed, reactive, ref, watch, nextTick } from "vue";
import LeafRating from "../components/LeafRating.vue";
import StatusPill from "../components/StatusPill.vue";
import { validateDraft } from "../services/song-adapter.js";
import DraftRecovery from "../components/DraftRecovery.vue";
import { isSongDraft } from "../services/song-draft.js";
import { useEditorDraft } from "../services/useEditorDraft.js";
import CoverImage from "../components/CoverImage.vue";
const genres = ["가요", "발라드", "팝", "애니", "재즈", "기타"];
const statuses = PRACTICE_OPTIONS.map((option) => option.view);

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
const saveErrorElement = ref(null);
const baseline = ref("");
const sourceRevision = ref(0);
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
  sourceRevision.value = song?.revision || 0;
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
    sourceRevision: sourceRevision.value,
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
    sourceRevision.value =
      value.sourceRevision ??
      (value.sourceUpdatedAt === (props.song?.updatedAt || null)
        ? props.song?.revision || 0
        : 0);
  },
});
const { pending, storageError } = drafts;
function saved() {
  markSaved();
  drafts.clear();
}
function currentDraft() {
  return { ...form, sourceRevision: sourceRevision.value };
}
function applyReview(value) {
  for (const key of Object.keys(form))
    if (Object.hasOwn(value, key)) form[key] = value[key];
  sourceRevision.value = value.sourceRevision;
  error.value = "";
  drafts.persist();
}
defineExpose({
  dirty,
  busy,
  markSaved: saved,
  discardDraft: drafts.clear,
  currentDraft,
  applyReview,
});

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
    ...(props.connected && isEdit.value
      ? { sourceRevision: sourceRevision.value }
      : {}),
  };
  busy.value = true;
  try {
    if (props.saveAction) await props.saveAction(payload);
    else emit("save", payload);
  } catch (err) {
    error.value = err.message || "저장하지 못했어요. 다시 시도해주세요.";
    await nextTick();
    saveErrorElement.value?.focus();
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
  <section class="page-intro form-intro" :class="{ 'song-heading': connected }">
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
    <slot name="guide" />
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
          <div class="field">
            <FieldLabel
              for-id="song-title"
              label="곡명"
              required
              :help="SONG_FIELD_HELP.title"
            /><input
              id="song-title"
              v-model="form.title"
              required
              :maxlength="SONG_TEXT_FIELDS.title.max"
              placeholder="노래 제목을 입력하세요"
            />
          </div>
          <div class="field">
            <FieldLabel
              for-id="song-artist"
              label="아티스트"
              required
              :help="SONG_FIELD_HELP.artist"
            /><input
              id="song-artist"
              v-model="form.artist"
              required
              :maxlength="SONG_TEXT_FIELDS.artist.max"
              placeholder="가수 또는 아티스트명"
            />
          </div>
          <div class="field">
            <FieldLabel
              for-id="song-genre"
              label="장르"
              :help="SONG_FIELD_HELP.genre"
            /><input
              id="song-genre"
              v-model="form.genre"
              list="preview-genres"
              :maxlength="SONG_TEXT_FIELDS.genre.max"
              placeholder="장르를 선택하거나 입력하세요"
            /><datalist id="preview-genres">
              <option
                v-for="item in genres.filter((value) => value !== '전체')"
                :key="item"
                :value="item"
              />
            </datalist>
          </div>
          <div class="field">
            <FieldLabel
              for-id="song-balloon"
              label="신청 풍 개수"
              required
              :help="SONG_FIELD_HELP.balloonCount"
            /><input
              id="song-balloon"
              v-model.number="form.balloonCount"
              type="number"
              min="0"
              step="1"
              required
            />
          </div>
        </div>
        <div class="form-grid form-extra">
          <div class="field">
            <FieldLabel
              for-id="song-language"
              label="언어"
              :help="SONG_FIELD_HELP.language"
            /><input
              id="song-language"
              v-model="form.language"
              :maxlength="SONG_TEXT_FIELDS.language.max"
              placeholder="예: 한국어"
            />
          </div>
          <div class="field">
            <FieldLabel
              for-id="song-public"
              label="공개 상태"
              :help="SONG_FIELD_HELP.isPublic"
            /><select id="song-public" v-model="form.isPublic">
              <option :value="true">공개</option>
              <option :value="false">비공개</option>
            </select>
          </div>
        </div>
        <div class="form-divider"></div>
        <div class="form-grid">
          <div class="field">
            <FieldLabel label="숙련도" required :help="SONG_FIELD_HELP.level" />
            <div class="rating-input">
              <LeafRating
                :value="Number(form.level)"
                editable
                show-number
                @change="form.level = $event"
              />
            </div>
          </div>
          <fieldset class="field">
            <legend>
              연습 상태 <b aria-hidden="true">*</b
              ><HelpTooltip
                label="연습 상태"
                :text="SONG_FIELD_HELP.practiceStatus"
              />
            </legend>
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
        <div class="field full-width">
          <FieldLabel
            for-id="song-description"
            label="곡 설명"
            :help="SONG_FIELD_HELP.description"
          /><textarea
            id="song-description"
            v-model="form.description"
            :maxlength="SONG_TEXT_FIELDS.description.max"
            rows="4"
            placeholder="곡의 분위기나 소개를 적어주세요."
          ></textarea
          ><small class="field-count"
            >{{ form.description.length }} /
            {{ SONG_TEXT_FIELDS.description.max }}</small
          >
        </div>
        <div class="field full-width">
          <FieldLabel
            for-id="song-memo"
            label="지오 메모"
            badge="관리자 전용"
            :help="SONG_FIELD_HELP.privateMemo"
          /><textarea
            id="song-memo"
            v-model="form.privateMemo"
            :maxlength="SONG_TEXT_FIELDS.memo.max"
            rows="3"
            placeholder="연습 포인트나 내부 메모를 적어주세요."
          ></textarea
          ><small class="field-count"
            >{{ form.privateMemo.length }} /
            {{ SONG_TEXT_FIELDS.memo.max }}</small
          >
        </div>
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
      <p
        v-if="error"
        ref="saveErrorElement"
        class="form-error"
        role="alert"
        tabindex="-1"
      >
        {{ error }}
      </p>
      <slot name="save-error" />
      <div class="song-save-bar">
        <SongSaveVisibility
          v-if="connected"
          :is-public="form.isPublic"
          :editing="isEdit"
        />
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
