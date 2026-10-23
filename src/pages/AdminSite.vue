<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { api } from "../services/api.js";
import { validateProfile, DEFAULT_PROFILE } from "../../shared/site-profile.js";
import { loadSiteProfile } from "../services/site-profile.js";
import { notify } from "../services/notifications.js";
import { useEditorGuard } from "../services/editor-guards.js";
import SiteSettingsTabs from "../components/SiteSettingsTabs.vue";
import Notice from "../components/Notice.vue";
import HelpTooltip from "../components/HelpTooltip.vue";
import "../styles/management.css";
const form = reactive(structuredClone(DEFAULT_PROFILE)),
  baseline = ref(""),
  revision = ref(0),
  loading = ref(true),
  ready = ref(false),
  busy = ref(false),
  error = ref(""),
  loadError = ref(""),
  soop = ref(""),
  query = ref(""),
  matches = ref([]),
  selected = ref([]),
  searchBusy = ref(false),
  conflict = ref(false);
const dirty = computed(
  () => ready.value && JSON.stringify(form) !== baseline.value,
);
useEditorGuard(() => dirty.value || busy.value);
const controller = new AbortController();
let searchSequence = 0;
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await api("/admin/site", { signal: controller.signal });
    Object.assign(form, data.profile);
    revision.value = data.revision;
    soop.value = data.soop_url;
    selected.value = await Promise.all(
      form.featured_ids.map(async (id) => {
        try {
          return await api("/admin/songs/" + id, { signal: controller.signal });
        } catch (e) {
          if (e.status === 404)
            return {
              id,
              title: "삭제된 추천 곡",
              artist: "선택을 해제해주세요",
            };
          throw e;
        }
      }),
    );
    baseline.value = JSON.stringify(form);
    conflict.value = false;
    ready.value = true;
    error.value = "";
  } catch (e) {
    if (e.name !== "AbortError") loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
async function search() {
  const current = ++searchSequence;
  searchBusy.value = true;
  error.value = "";
  try {
    const data = await api(
      "/admin/songs?q=" +
        encodeURIComponent(query.value) +
        "&is_public=true&page_size=20",
      { signal: controller.signal },
    );
    if (current === searchSequence) matches.value = data.items;
  } catch (e) {
    if (e.name !== "AbortError") error.value = e.message;
  } finally {
    if (current === searchSequence) searchBusy.value = false;
  }
}
function add(song) {
  if (form.featured_ids.includes(song.id) || form.featured_ids.length >= 4)
    return;
  form.featured_ids.push(song.id);
  selected.value.push(song);
}
function remove(id) {
  form.featured_ids = form.featured_ids.filter((value) => value !== id);
  selected.value = selected.value.filter((song) => song.id !== id);
}
async function save() {
  if (busy.value || conflict.value) return;
  error.value = "";
  try {
    const value = validateProfile(form);
    busy.value = true;
    const data = await api("/admin/site", {
      method: "PUT",
      body: { ...value, expected_revision: revision.value },
    });
    Object.assign(form, data.profile);
    revision.value = data.revision;
    baseline.value = JSON.stringify(form);
    await loadSiteProfile().catch(() => {});
    notify("홈페이지 소개와 추천 곡을 저장했어요.");
  } catch (e) {
    error.value = e.message;
    conflict.value = e.status === 409;
  } finally {
    busy.value = false;
  }
}
onBeforeRouteLeave(
  (to) =>
    ["/admin/login", "/admin/password"].includes(to.path) ||
    (!busy.value &&
      (!dirty.value ||
        window.confirm("소개 설정을 저장하지 않고 이동할까요?"))),
);
function unload(e) {
  if (dirty.value || busy.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}
onMounted(() => {
  load();
  window.addEventListener("beforeunload", unload);
});
onBeforeUnmount(() => {
  controller.abort();
  window.removeEventListener("beforeunload", unload);
});
</script>
<template>
  <div class="management-page">
    <div class="management-breadcrumb">
      <RouterLink to="/admin">관리</RouterLink><span>›</span
      ><span>홈페이지 관리</span>
    </div>
    <SiteSettingsTabs />
    <header class="management-heading">
      <div>
        <span class="management-kicker">방문자를 맞이하는 첫 인사</span>
        <h1>홈페이지 관리</h1>
        <p>소개 문구와 공식 링크, 먼저 보여줄 노래를 정해요.</p>
      </div>
    </header>
    <Notice :loading="loading" :error="loadError" @retry="load" />
    <form
      v-if="ready && !loading"
      class="card site-profile-form"
      aria-label="홈페이지 기본 정보"
      @submit.prevent="save"
    >
      <fieldset class="editor-fields" :disabled="busy">
        <h2>우리 공간 소개</h2>
        <label class="field"
          >메인 제목<input
            v-model="form.intro_title"
            required
            maxlength="60" /></label
        ><label class="field"
          >메인 소개<textarea
            v-model="form.intro_text"
            required
            maxlength="300"
            rows="3"
          /></label
        ><label class="field"
          >지오 소개<textarea
            v-model="form.about_text"
            required
            maxlength="1500"
            rows="5"
          />
        </label>
        <h2>공식 링크</h2>
        <p class="help-text">
          SOOP 방송국 주소: {{ soop }} ·
          <RouterLink to="/admin/menus">메뉴 구성에서 주소 수정</RouterLink>
        </p>
        <div
          v-for="(link, index) in form.social_links"
          :key="index"
          class="profile-link-row"
        >
          <label class="field"
            >링크 이름<input
              v-model="link.label"
              maxlength="24"
              required /></label
          ><label class="field"
            >HTTPS 주소<input
              v-model="link.href"
              type="url"
              maxlength="2048"
              required
              placeholder="https://" /></label
          ><button
            type="button"
            class="text-button"
            :aria-label="index + 1 + '번째 공식 링크 삭제'"
            @click="form.social_links.splice(index, 1)"
          >
            삭제
          </button>
        </div>
        <button
          type="button"
          class="button secondary"
          :disabled="form.social_links.length >= 5"
          @click="form.social_links.push({ label: '', href: '' })"
        >
          공식 링크 추가
        </button>
        <h2>
          먼저 들려주고 싶은 곡
          <HelpTooltip
            label="추천 곡"
            text="최대 4곡을 선택 순서대로 보여줘요. 선택하지 않거나 공개 곡이 없으면 최신 곡을 보여줍니다. 비공개·삭제된 곡은 방문자에게 보이지 않아요."
          />
        </h2>
        <ol class="profile-featured">
          <li v-for="song in selected" :key="song.id">
            <span
              >{{ song.title }} · {{ song.artist }}
              <small v-if="song.is_public === false">(비공개)</small></span
            ><button
              type="button"
              class="text-button"
              :aria-label="song.title + ' 추천 해제'"
              @click="remove(song.id)"
            >
              해제
            </button>
          </li>
        </ol>
        <div class="catalog-search">
          <label class="field"
            >추천할 공개 곡 검색<input
              v-model="query"
              maxlength="200"
              @keydown.enter.prevent="search" /></label
          ><button
            type="button"
            class="button secondary"
            :disabled="searchBusy"
            @click="search"
          >
            곡 찾기
          </button>
        </div>
        <ul class="profile-featured">
          <li v-for="song in matches" :key="song.id">
            <span>{{ song.title }} · {{ song.artist }}</span
            ><button
              type="button"
              class="text-button"
              :disabled="
                form.featured_ids.includes(song.id) ||
                form.featured_ids.length >= 4
              "
              @click="add(song)"
            >
              {{
                form.featured_ids.includes(song.id) ? "선택됨" : "추천에 추가"
              }}
            </button>
          </li>
        </ul>
      </fieldset>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <button
        v-if="conflict"
        type="button"
        class="button secondary"
        @click="load"
      >
        최신 설정 다시 불러오기
      </button>
      <div class="form-actions">
        <span class="help-text">저장하면 홈페이지와 소개 화면에 공개돼요.</span
        ><button class="button primary" :disabled="busy || !dirty || conflict">
          {{ busy ? "저장 중…" : "홈페이지 정보 저장" }}
        </button>
      </div>
    </form>
  </div>
</template>
