<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { api, session } from "../services/api.js";
import Icon from "../components/Icon.vue";
const username = ref(""),
  password = ref(""),
  busy = ref(false),
  error = ref("");
const router = useRouter(),
  route = useRoute();
async function login() {
  busy.value = true;
  error.value = "";
  try {
    const data = await api("/admin/login", {
      method: "POST",
      body: { username: username.value, password: password.value },
    });
    Object.assign(session, data, { checked: true });
    password.value = "";
    router.replace(
      data.user.must_change_password ? "/admin/password" : "/admin",
    );
  } catch (err) {
    error.value = err.message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <div class="container login-page">
    <section class="login-card">
      <div class="login-icon"><Icon name="lock" :size="27" /></div>
      <span class="eyebrow">ZIO HOME ADMIN</span>
      <h1>다시 만나 반가워요.</h1>
      <p>관리자 계정으로 노래책자와 관리자 계정을 관리하세요.</p>
      <p v-if="route.query.expired" class="form-hint" role="status">
        세션이 만료되었습니다. 다시 로그인해주세요.
      </p>
      <p v-if="route.query.unavailable" class="form-error" role="alert">
        인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.
      </p>
      <p v-if="route.query.password_changed" class="form-hint" role="status">
        비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.
      </p>
      <p v-if="route.query.reset" class="form-hint" role="status">
        비밀번호를 초기화했습니다. 초기 비밀번호로 로그인한 뒤 새 비밀번호를
        설정해주세요.
      </p>
      <form @submit.prevent="login">
        <label class="field"
          >아이디<input
            v-model="username"
            name="username"
            autocomplete="username"
            required
            maxlength="80"
            :disabled="busy" /></label
        ><label class="field"
          >비밀번호<input
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            maxlength="256"
            :disabled="busy"
        /></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="button primary full-width" :disabled="busy">
          {{ busy ? "로그인 중…" : "로그인" }}<Icon name="arrow" :size="18" />
        </button>
      </form>
      <p class="login-note">
        운영자가 설정한 관리자 계정으로만 접근할 수 있습니다.
      </p>
      <RouterLink to="/" class="text-button"
        ><Icon name="back" :size="16" />홈으로 돌아가기</RouterLink
      >
    </section>
  </div>
</template>
