<script setup>
import "../styles/management.css";
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { api } from "../services/api.js";
import {
  appearance,
  previewTheme,
  setSiteTheme,
} from "../services/appearance.js";
import { useEditorGuard } from "../services/editor-guards.js";
import { notify } from "../services/notifications.js";
import SiteSettingsTabs from "../components/SiteSettingsTabs.vue";
import ThemeChoices from "../components/ThemeChoices.vue";
import SceneBanner from "../components/SceneBanner.vue";
import Notice from "../components/Notice.vue";
const selected = ref("forest"),
  saved = ref("forest"),
  revision = ref(0),
  loading = ref(true),
  ready = ref(false),
  busy = ref(false),
  error = ref(""),
  loadError = ref(""),
  conflict = ref(false);
const dirty = computed(() => ready.value && selected.value !== saved.value);
useEditorGuard(() => dirty.value || busy.value);
onBeforeRouteLeave(
  (to) =>
    ["/admin/login", "/admin/password"].includes(to.path) ||
    (!busy.value &&
      (!dirty.value ||
        window.confirm("선택한 테마를 저장하지 않고 이동할까요?"))),
);
function beforeUnload(event) {
  if (dirty.value || busy.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
async function load() {
  loading.value = true;
  loadError.value = "";
  error.value = "";
  previewTheme(null);
  try {
    const data = await api("/admin/appearance");
    selected.value = saved.value = data.theme;
    revision.value = data.revision;
    setSiteTheme(data.theme);
    ready.value = true;
    conflict.value = false;
  } catch (e) {
    loadError.value = e.message;
    ready.value = false;
  } finally {
    loading.value = false;
  }
}
function select(value) {
  selected.value = value;
  if (!conflict.value) error.value = "";
  if (appearance.preview) previewTheme(value);
}
function cancelPreview() {
  previewTheme(null);
}
function cancel() {
  selected.value = saved.value;
  if (!conflict.value) error.value = "";
  previewTheme(null);
}
async function save() {
  if (busy.value || !dirty.value || conflict.value) return;
  busy.value = true;
  error.value = "";
  try {
    const data = await api("/admin/appearance", {
      method: "PUT",
      body: { theme: selected.value, expected_revision: revision.value },
    });
    saved.value = selected.value = data.theme;
    revision.value = data.revision;
    setSiteTheme(data.theme);
    previewTheme(null);
    notify("사이트 기본 테마를 저장했어요.");
  } catch (e) {
    error.value = e.message;
    conflict.value = e.status === 409;
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  window.addEventListener("beforeunload", beforeUnload);
  load();
});
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", beforeUnload);
  previewTheme(null);
});
</script>
<template>
  <div class="management-page appearance-page">
    <div class="management-breadcrumb">
      <RouterLink to="/admin">관리</RouterLink><span>›</span
      ><RouterLink to="/admin/menus">메뉴 관리</RouterLink><span>›</span
      ><span>테마 설정</span>
    </div>
    <SiteSettingsTabs />
    <header class="management-heading">
      <div>
        <span class="management-kicker">우리 공간의 새로운 분위기</span>
        <h1>테마 설정</h1>
        <p>방문자를 처음 맞이할 사이트의 기본 테마를 골라주세요.</p>
      </div>
    </header>
    <Notice
      :loading="loading"
      :error="loadError"
      loading-message="테마 설정을 불러오고 있어요."
      @retry="load"
    />
    <template v-if="ready && !loading">
      <div v-if="appearance.preview" class="theme-preview-notice" role="status">
        <span>미리보기 중 · 다른 방문자에게는 아직 적용되지 않았어요.</span
        ><button class="button secondary" @click="cancelPreview">
          미리보기 종료
        </button>
      </div>
      <div class="appearance-layout">
        <section class="appearance-settings card">
          <h2>어떤 분위기가 좋을까요?</h2>
          <p>선택 후 미리보기로 화면 전체를 살펴보세요.</p>
          <ThemeChoices
            :model-value="selected"
            :disabled="busy"
            @update:model-value="select"
          /><button
            class="button secondary"
            :disabled="busy"
            @click="previewTheme(selected)"
          >
            이 테마 미리보기
          </button>
        </section>
        <aside class="appearance-preview card">
          <SceneBanner title="당신의 오늘에, 작은 노래 한 곡" />
          <h2>노래가 모이는 우리 공간</h2>
          <p>
            세 가지 테마 모두 밝은 화면을 사용해 노래 정보와 입력 내용을 편하게
            읽을 수 있어요.
          </p>
          <div class="appearance-explanation">
            <strong>방문자의 선택도 존중해요</strong>
            <p>
              개인 테마를 선택한 방문자는 자신의 선택을 유지합니다. ‘사이트
              기본값 따르기’를 선택하면 이 설정이 적용돼요.
            </p>
          </div>
          <p v-if="appearance.preference !== 'site'" class="theme-default-note">
            현재 브라우저는 개인 테마를 사용 중이에요. 저장 후에도 내 화면은
            개인 선택을 따릅니다.
          </p>
        </aside>
      </div>
      <div class="menu-save-bar">
        <span>{{
          dirty
            ? "새 테마를 선택했어요 · 저장하면 사이트 기본값으로 적용됩니다"
            : "현재 저장된 테마예요"
        }}</span>
        <div class="theme-save-actions">
          <button
            class="button secondary"
            :disabled="busy || (!dirty && !appearance.preview)"
            @click="cancel"
          >
            선택 취소</button
          ><button
            class="button primary"
            :disabled="busy || !dirty || conflict"
            @click="save"
          >
            {{ busy ? "저장 중…" : "기본 테마 저장" }}
          </button>
        </div>
      </div>
      <div v-if="error" class="form-error" role="alert">
        <p>{{ error }}</p>
        <button v-if="conflict" class="button secondary" @click="load">
          최신 설정 불러오기
        </button>
      </div>
    </template>
  </div>
</template>
