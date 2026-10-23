<script setup>
import "../styles/management.css";
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api, session } from "../services/api.js";
import { notify } from "../services/notifications.js";
import AdminNav from "../components/AdminNav.vue";
import AdminRegister from "../components/AdminRegister.vue";
import Notice from "../components/Notice.vue";
import Icon from "../components/Icon.vue";
import Modal from "../components/Modal.vue";
import Pagination from "../components/Pagination.vue";
defineProps({ resetMode: Boolean });
const router = useRouter();
const items = ref([]),
  total = ref(0),
  page = ref(1),
  loading = ref(true),
  error = ref("");
const creating = ref(false),
  resetting = ref(null),
  busy = ref(false),
  resetError = ref("");
const pages = computed(() => Math.max(1, Math.ceil(total.value / 20)));
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const data = await api(`/admin/users?page=${page.value}&page_size=20`);
    items.value = data.items;
    total.value = data.pagination.total;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
function registered() {
  creating.value = false;
  notify("관리자를 등록했습니다.");
  page.value = 1;
  load();
}
async function reset() {
  busy.value = true;
  resetError.value = "";
  try {
    const result = await api(
      `/admin/users/${resetting.value.id}/reset-password`,
      { method: "POST" },
    );
    resetting.value = null;
    if (result.logged_out) {
      session.user = null;
      session.csrfToken = "";
      router.replace("/admin/login?reset=1");
      return;
    }
    notify(
      "비밀번호를 초기화했습니다. 대상 관리자는 다시 로그인한 뒤 비밀번호를 변경해야 합니다.",
    );
    await load();
  } catch (err) {
    resetError.value = err.message;
  } finally {
    busy.value = false;
  }
}
const accountAction = ref(null),
  accountError = ref("");
function chooseAction(account, mode) {
  accountAction.value = { account, mode };
  accountError.value = "";
}
async function applyAccountAction() {
  if (busy.value) return;
  busy.value = true;
  accountError.value = "";
  const { account, mode } = accountAction.value;
  try {
    await api(
      "/admin/users/" +
        account.id +
        (mode === "revoke" ? "/revoke-sessions" : "/status"),
      {
        method: mode === "revoke" ? "POST" : "PATCH",
        ...(mode === "revoke"
          ? {}
          : {
              body: {
                is_active: !account.is_active,
                expected_revision: account.revision,
              },
            }),
      },
    );
    accountAction.value = null;
    notify(
      mode === "revoke"
        ? "기존 로그인을 모두 해제했어요."
        : account.is_active
          ? "관리자 사용을 중지했어요."
          : "관리자 사용을 재개했어요.",
    );
    await load();
  } catch (e) {
    accountError.value = e.message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div class="container page admin-users-page">
    <div class="breadcrumb">
      <RouterLink to="/">홈</RouterLink><span>/</span>
      <RouterLink to="/admin">관리 홈</RouterLink><span>/</span>
      {{ resetMode ? "관리자 비밀번호 초기화" : "관리자 관리" }}
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">함께 운영하는 사람들</span>
        <h1>
          {{ resetMode ? "관리자 비밀번호 초기화" : "관리자 관리"
          }}<span class="green-period">.</span>
        </h1>
        <p>
          {{
            resetMode
              ? "초기화할 관리자 계정을 선택해주세요."
              : "관리자 목록을 확인하고 새 관리자를 등록하세요."
          }}
        </p>
      </div>
      <button
        v-if="!resetMode"
        class="button primary"
        :disabled="busy"
        @click="creating = true"
      >
        <Icon name="plus" :size="18" />관리자 등록
      </button>
    </div>
    <AdminNav />
    <p class="form-hint">
      총 {{ total }}명의 관리자 ·
      {{
        resetMode
          ? "초기화 후 대상 계정의 기존 로그인이 모두 해제됩니다."
          : "모든 관리자는 동일한 관리 권한을 갖습니다."
      }}
    </p>
    <div class="results-panel" :aria-busy="loading">
      <Notice
        :loading="loading"
        :error="error"
        :empty="!items.length"
        title="등록된 관리자가 없어요"
        loading-message="관리자 목록을 불러오고 있어요."
        @retry="load"
      />
      <div v-if="!loading && !error && items.length" class="admin-account-list">
        <article
          v-for="account in items"
          :key="account.id"
          class="admin-account"
        >
          <div class="account-info">
            <h2>
              {{ account.display_name || account.username
              }}<span v-if="account.id === session.user?.id" class="badge"
                >내 계정</span
              >
            </h2>
            <p>{{ account.username }}</p>
            <div class="account-status">
              <span
                class="badge"
                :class="
                  account.is_active ? 'status-completed' : 'status-on_hold'
                "
                >{{ account.is_active ? "활성" : "비활성" }}</span
              ><span
                v-if="account.must_change_password"
                class="badge status-practicing"
                >비밀번호 변경 필요</span
              >
            </div>
          </div>
          <div v-if="!resetMode" class="account-actions">
            <button
              class="button secondary small"
              :disabled="busy || account.id === session.user?.id"
              :aria-label="
                account.username +
                (account.is_active ? ' 사용 중지' : ' 사용 재개')
              "
              @click="chooseAction(account, 'status')"
            >
              {{ account.is_active ? "사용 중지" : "사용 재개" }}</button
            ><button
              class="button secondary small"
              :disabled="busy || account.id === session.user?.id"
              :aria-label="account.username + ' 로그인 해제'"
              @click="chooseAction(account, 'revoke')"
            >
              로그인 해제
            </button>
          </div>
          <button
            v-if="resetMode"
            class="button secondary small"
            :disabled="busy"
            :aria-label="`${account.username} 비밀번호 초기화`"
            @click="
              resetting = account;
              resetError = '';
            "
          >
            <Icon name="lock" :size="15" />비밀번호 초기화
          </button>
        </article>
      </div>
    </div>
    <Pagination
      :page="page"
      :pages="pages"
      :disabled="loading"
      @change="
        page = $event;
        load();
      "
    />
    <Modal
      v-if="accountAction"
      :title="
        accountAction.mode === 'revoke'
          ? '기존 로그인을 해제할까요?'
          : accountAction.account.is_active
            ? '관리자 사용을 중지할까요?'
            : '관리자 사용을 재개할까요?'
      "
      :busy="busy"
      @close="accountAction = null"
      ><p class="modal-intro">
        <strong
          >{{ accountAction.account.display_name }} ({{
            accountAction.account.username
          }})</strong
        ><br />{{
          accountAction.mode === "revoke"
            ? "모든 기기의 로그인을 해제해요. 계정과 비밀번호는 유지되며 다시 로그인할 수 있어요."
            : accountAction.account.is_active
              ? "이 계정은 로그인할 수 없게 되고 기존 로그인도 모두 해제됩니다. 등록한 노래와 일정은 유지돼요."
              : "이 계정이 기존 비밀번호로 다시 로그인할 수 있게 돼요."
        }}
      </p>
      <p v-if="accountError" class="form-error" role="alert">
        {{ accountError }}
      </p>
      <div class="modal-actions">
        <button
          class="button secondary"
          :disabled="busy"
          @click="accountAction = null"
        >
          취소</button
        ><button
          class="button primary"
          :disabled="busy"
          @click="applyAccountAction"
        >
          {{ busy ? "처리 중…" : "확인하고 적용" }}
        </button>
      </div></Modal
    >
    <AdminRegister
      v-if="!resetMode && creating"
      @close="creating = false"
      @registered="registered"
    />
    <Modal
      v-if="resetMode && resetting"
      title="비밀번호를 초기화할까요?"
      :busy="busy"
      @close="resetting = null"
    >
      <p class="modal-intro">
        <strong
          >{{ resetting.display_name || resetting.username }} ({{
            resetting.username
          }})</strong
        >
        계정의 비밀번호를 초기 비밀번호로 변경합니다.<br />기존 로그인은 모두
        해제되며, 다음 로그인 후 비밀번호를 변경해야 합니다.<template
          v-if="resetting.id === session.user?.id"
          ><br />내 계정을 초기화하면 지금 로그아웃됩니다.</template
        >
      </p>
      <p v-if="resetError" class="form-error" role="alert">{{ resetError }}</p>
      <div class="modal-actions">
        <button
          class="button secondary"
          :disabled="busy"
          @click="resetting = null"
        >
          취소</button
        ><button class="button destructive" :disabled="busy" @click="reset">
          {{ busy ? "초기화 중…" : "초기화하기" }}
        </button>
      </div>
    </Modal>
  </div>
</template>
