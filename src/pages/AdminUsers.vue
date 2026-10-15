<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api, session } from "../services/api.js";
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
  resetError = ref(""),
  toast = ref("");
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
  toast.value = "관리자를 등록했습니다.";
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
    toast.value =
      "비밀번호를 초기화했습니다. 대상 관리자는 다시 로그인한 뒤 비밀번호를 변경해야 합니다.";
    await load();
  } catch (err) {
    resetError.value = err.message;
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
      <RouterLink to="/admin">관리자 메뉴</RouterLink><span>/</span>
      {{ resetMode ? "관리자 비밀번호 초기화" : "관리자 관리" }}
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">YOUR ADMIN TEAM</span>
        <h1>{{ resetMode ? "관리자 비밀번호 초기화" : "관리자 관리" }}<span class="green-period">.</span></h1>
        <p>{{ resetMode ? "초기화할 관리자 계정을 선택해주세요." : "관리자 목록을 확인하고 새 관리자를 등록하세요." }}</p>
      </div>
      <button v-if="!resetMode" class="button primary" :disabled="busy" @click="creating = true">
        <Icon name="plus" :size="18" />관리자 등록
      </button>
    </div>
    <AdminNav />
    <div v-if="toast" class="toast" role="status">
      <Icon name="check" :size="18" />{{ toast
      }}<button class="icon-button" aria-label="알림 닫기" @click="toast = ''">
        <Icon name="close" :size="16" />
      </button>
    </div>
    <p class="form-hint">
      총 {{ total }}명의 관리자 · {{ resetMode ? "초기화 후 대상 계정의 기존 로그인이 모두 해제됩니다." : "모든 관리자는 동일한 관리 권한을 갖습니다." }}
    </p>
    <div class="results-panel" :aria-busy="loading">
      <Notice
        :loading="loading"
        :error="error"
        :empty="!items.length"
        title="등록된 관리자가 없어요"
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
