<script setup>
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { api } from "../services/api.js";
import { notify } from "../services/notifications.js";
import { queryPage, pageCount } from "../../shared/pagination.js";
import Notice from "../components/Notice.vue";
import Pagination from "../components/Pagination.vue";
import Modal from "../components/Modal.vue";
import "../styles/management.css";
const route = useRoute(),
  router = useRouter(),
  type = computed(() =>
    ["songs", "events", "history"].includes(route.query.type)
      ? route.query.type
      : "songs",
  ),
  page = computed(() => queryPage(route.query.page, 100000));
const items = ref([]),
  total = ref(0),
  loading = ref(true),
  error = ref(""),
  action = ref(null),
  busy = ref(false),
  actionError = ref("");
const labels = {
    songs: "노래 휴지통",
    events: "일정 휴지통",
    history: "최근 변경 기록",
  },
  actions = {
    create: "등록",
    update: "수정",
    trash: "휴지통 이동",
    restore: "복원",
    purge: "영구 삭제",
    activate: "사용 재개",
    deactivate: "사용 중지",
    revoke: "로그인 해제",
  },
  entityLabels = { song: "노래", event: "일정", admin: "관리자" };
let controller,
  sequence = 0;
async function load() {
  controller?.abort();
  controller = new AbortController();
  const current = ++sequence;
  loading.value = true;
  error.value = "";
  try {
    const data = await api(
      "/admin/recovery/" + type.value + "?page=" + page.value,
      { signal: controller.signal },
    );
    if (current !== sequence) return;
    items.value = data.items;
    total.value = data.pagination.total;
    if (page.value > pageCount(total.value, 20))
      await router.replace({
        path: "/admin/recovery",
        query: { type: type.value, page: String(pageCount(total.value, 20)) },
      });
  } catch (e) {
    if (e.name !== "AbortError" && current === sequence)
      error.value = e.message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
function navigate(value, nextPage = 1) {
  if (busy.value) return;
  return router.replace({
    path: "/admin/recovery",
    query: { type: value, ...(nextPage > 1 ? { page: String(nextPage) } : {}) },
  });
}
function choose(item, mode) {
  action.value = { item, mode, type: type.value };
  actionError.value = "";
}
async function run() {
  if (busy.value) return;
  busy.value = true;
  actionError.value = "";
  const selected = action.value;
  try {
    await api(
      "/admin/recovery/" +
        selected.type +
        "/" +
        selected.item.id +
        (selected.mode === "restore" ? "/restore" : ""),
      {
        method: selected.mode === "restore" ? "POST" : "DELETE",
        body: { expected_revision: selected.item.revision },
      },
    );
    action.value = null;
    notify(
      selected.mode === "restore"
        ? selected.type === "songs"
          ? "노래를 비공개 상태로 복원했어요."
          : "일정을 복원했어요."
        : "항목을 영구 삭제했어요.",
    );
    await load();
  } catch (e) {
    actionError.value = e.message;
  } finally {
    busy.value = false;
  }
}
function date(value) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
watch([type, page], load, { immediate: true });
onBeforeUnmount(() => {
  controller?.abort();
  sequence++;
});
onBeforeRouteLeave(
  (to) => ["/admin/login", "/admin/password"].includes(to.path) || !busy.value,
);
</script>
<template>
  <div class="management-page">
    <div class="management-breadcrumb">
      <RouterLink to="/admin">관리 홈</RouterLink><span>›</span
      ><span>휴지통과 변경 기록</span>
    </div>
    <header class="management-heading">
      <div>
        <span class="management-kicker">작업을 돌아보는 공간</span>
        <h1>휴지통과 변경 기록</h1>
        <p>삭제한 노래와 개별 일정을 다시 꺼내고 최근 작업을 확인해요.</p>
      </div>
    </header>
    <nav class="site-settings-tabs" aria-label="복구와 기록">
      <button
        v-for="(label, key) in labels"
        :key="key"
        type="button"
        :aria-pressed="type === key"
        :disabled="busy"
        @click="navigate(key)"
      >
        {{ label }}
      </button>
    </nav>
    <p class="help-text">
      {{
        type === "history"
          ? "등록·수정·삭제와 계정 사용 여부를 기록해요. 비밀번호와 메모 내용은 기록하지 않습니다."
          : "휴지통 항목은 직접 영구 삭제하기 전까지 보관돼요. 노래를 복원하면 비공개 상태로 돌아옵니다. 주간 이미지 메모는 이 휴지통에 포함되지 않아요."
      }}
    </p>
    <div class="recovery-links">
      <RouterLink to="/admin/songs">노래 관리</RouterLink
      ><RouterLink to="/admin/schedule">일정 관리</RouterLink>
    </div>
    <Notice
      :loading="loading"
      :error="error"
      :empty="!items.length"
      title="아직 담긴 항목이 없어요"
      @retry="load"
    />
    <div v-if="!loading && !error" class="recovery-list">
      <article v-for="item in items" :key="item.id" class="card recovery-item">
        <div>
          <span v-if="type === 'history'" class="management-kicker"
            >{{ entityLabels[item.entity_type] }} ·
            {{ actions[item.action] || item.action }}</span
          >
          <h2>{{ item.title }}</h2>
          <p v-if="item.artist">{{ item.artist }}</p>
          <small
            >{{ date(type === "history" ? item.created_at : item.deleted_at)
            }}<template v-if="type === 'history'">
              · {{ item.actor || "이전 기록 또는 계정 없음" }}</template
            ></small
          >
        </div>
        <div v-if="type !== 'history'" class="recovery-actions">
          <button
            class="button secondary"
            :disabled="busy"
            :aria-label="item.title + ' 복원'"
            @click="choose(item, 'restore')"
          >
            복원</button
          ><button
            class="button destructive"
            :disabled="busy"
            :aria-label="item.title + ' 영구 삭제'"
            @click="choose(item, 'purge')"
          >
            영구 삭제
          </button>
        </div>
      </article>
    </div>
    <Pagination
      :page="page"
      :pages="pageCount(total, 20)"
      :disabled="loading || busy"
      @change="navigate(type, $event)"
    /><Modal
      v-if="action"
      :title="
        action.mode === 'restore' ? '항목을 복원할까요?' : '영구 삭제할까요?'
      "
      :busy="busy"
      @close="action = null"
      ><p class="modal-intro">
        <strong>{{ action.item.title }}</strong
        ><br />{{
          action.mode === "restore"
            ? action.type === "songs"
              ? "노래 정보와 앨범 연결을 유지한 채 비공개로 복원해요."
              : "삭제한 개별 일정을 달력과 목록으로 복원해요."
            : "영구 삭제한 항목은 이 화면에서 되돌릴 수 없어요."
        }}
      </p>
      <p v-if="actionError" class="form-error" role="alert">
        {{ actionError }}
      </p>
      <div class="modal-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="busy"
          @click="action = null"
        >
          취소</button
        ><button
          type="button"
          class="button"
          :class="action.mode === 'restore' ? 'primary' : 'destructive'"
          :disabled="busy"
          @click="run"
        >
          {{
            busy
              ? "처리 중…"
              : action.mode === "restore"
                ? "복원하기"
                : "영구 삭제하기"
          }}
        </button>
      </div></Modal
    >
  </div>
</template>
