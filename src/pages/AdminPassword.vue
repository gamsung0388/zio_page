<script setup>
import "../styles/management.css";
import { ref, reactive, computed, useId } from "vue";
import { useRouter, useRoute } from "vue-router";
import { api, session } from "../services/api.js";
import { safeReturnTo } from "../services/return-to.js";
import AdminNav from "../components/AdminNav.vue";
import Icon from "../components/Icon.vue";
const prefix = useId(),
  router = useRouter(),
  route = useRoute();
const forced = computed(() => Boolean(session.user?.must_change_password));
const draft = reactive({
  current_password: "",
  password: "",
  password_confirmation: "",
});
const busy = ref(false),
  error = ref(""),
  details = ref([]);
async function save() {
  error.value = "";
  details.value = [];
  if (draft.password !== draft.password_confirmation) {
    error.value = "비밀번호 확인이 일치하지 않습니다.";
    return;
  }
  busy.value = true;
  try {
    await api("/admin/password", { method: "PATCH", body: { ...draft } });
    draft.current_password = "";
    draft.password = "";
    draft.password_confirmation = "";
    session.user = null;
    session.csrfToken = "";
    const next = safeReturnTo(route.query.next);
    router.replace({
      path: "/admin/login",
      query: { password_changed: "1", ...(next ? { next } : {}) },
    });
  } catch (err) {
    error.value = err.message;
    details.value = err.details || [];
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="container page admin-password-page">
    <div class="breadcrumb">
      <RouterLink to="/">홈</RouterLink><span>/</span>
      <template v-if="!forced"
        ><RouterLink to="/admin">관리 홈</RouterLink><span>/</span></template
      >
      관리자 비밀번호 변경
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">내 계정을 안전하게</span>
        <h1>관리자 비밀번호 변경<span class="green-period">.</span></h1>
        <p>
          {{
            forced
              ? "초기화된 비밀번호를 변경한 뒤 관리자 기능을 사용할 수 있습니다."
              : "현재 비밀번호를 확인하고 새 비밀번호를 설정하세요."
          }}
        </p>
      </div>
    </div>
    <AdminNav v-if="!forced" />
    <section class="password-card">
      <p v-if="forced" class="password-required" role="status">
        <Icon name="lock" :size="18" />초기화된 비밀번호의 변경이 필요합니다.
      </p>
      <p class="modal-intro">
        비밀번호를 변경하면 모든 기기에서 로그아웃됩니다. 새 비밀번호로 다시
        로그인해주세요.
      </p>
      <form @submit.prevent="save">
        <fieldset :disabled="busy">
          <div class="field">
            <label :for="`${prefix}-current`">현재 비밀번호</label
            ><input
              :id="`${prefix}-current`"
              v-model="draft.current_password"
              type="password"
              autocomplete="current-password"
              maxlength="256"
              required
            />
          </div>
          <div class="field">
            <label :for="`${prefix}-new`">새 비밀번호</label
            ><input
              :id="`${prefix}-new`"
              v-model="draft.password"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="256"
              required
              :aria-describedby="`${prefix}-hint`"
            /><small :id="`${prefix}-hint`"
              >8~256자. 현재 비밀번호 및 초기화 비밀번호와 다르게
              설정해주세요.</small
            >
          </div>
          <div class="field">
            <label :for="`${prefix}-confirm`">새 비밀번호 확인</label
            ><input
              :id="`${prefix}-confirm`"
              v-model="draft.password_confirmation"
              type="password"
              autocomplete="new-password"
              minlength="8"
              maxlength="256"
              required
            />
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
        <button class="button primary full-width" :disabled="busy">
          {{ busy ? "변경 중…" : "비밀번호 변경하기" }}
        </button>
      </form>
    </section>
  </div>
</template>
