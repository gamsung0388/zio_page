<script setup>
import { reactive, ref, useId, onBeforeUnmount } from "vue";
import { api } from "../services/api.js";
import Modal from "./Modal.vue";
const emit = defineEmits(["close", "registered"]);
const prefix = useId();
const draft = reactive({
  username: "",
  display_name: "",
  password: "",
  password_confirmation: "",
});
const busy = ref(false),
  error = ref(""),
  details = ref([]);
function clearPasswords() {
  draft.password = "";
  draft.password_confirmation = "";
}
onBeforeUnmount(clearPasswords);
async function register() {
  error.value = "";
  details.value = [];
  if (draft.password !== draft.password_confirmation) {
    error.value = "비밀번호 확인이 일치하지 않습니다.";
    return;
  }
  busy.value = true;
  try {
    const account = await api("/admin/users", {
      method: "POST",
      body: { ...draft },
    });
    clearPasswords();
    emit("registered", account);
  } catch (err) {
    error.value = err.message;
    details.value = err.details || [];
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Modal title="관리자 등록" :busy="busy" @close="emit('close')">
    <p class="modal-intro">
      새 계정은 노래 관리와 관리자 등록 권한을 갖습니다.
    </p>
    <form @submit.prevent="register">
      <fieldset :disabled="busy">
        <div class="field">
          <label :for="`${prefix}-username`">아이디</label>
          <input
            :id="`${prefix}-username`"
            v-model="draft.username"
            name="new-admin-username"
            autocomplete="off"
            autocapitalize="none"
            spellcheck="false"
            required
            minlength="3"
            maxlength="80"
            pattern="[A-Za-z0-9_.\-]{3,80}"
            :aria-describedby="`${prefix}-username-hint`"
            autofocus
          />
          <small :id="`${prefix}-username-hint`"
            >영문·숫자·점·밑줄·하이픈 3~80자. 대소문자를 구분합니다.</small
          >
        </div>
        <div class="field">
          <label :for="`${prefix}-display-name`">표시 이름</label>
          <input
            :id="`${prefix}-display-name`"
            v-model="draft.display_name"
            name="new-admin-display-name"
            autocomplete="off"
            maxlength="80"
            placeholder="비우면 아이디를 사용합니다"
          />
        </div>
        <div class="field">
          <label :for="`${prefix}-password`">비밀번호</label>
          <input
            :id="`${prefix}-password`"
            v-model="draft.password"
            name="new-admin-password"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="256"
            :aria-describedby="`${prefix}-password-hint`"
          />
          <small :id="`${prefix}-password-hint`"
            >8~256자로 입력해주세요.</small
          >
        </div>
        <div class="field">
          <label :for="`${prefix}-confirmation`">비밀번호 확인</label>
          <input
            :id="`${prefix}-confirmation`"
            v-model="draft.password_confirmation"
            name="new-admin-password-confirmation"
            type="password"
            autocomplete="new-password"
            required
            minlength="8"
            maxlength="256"
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
      <div class="modal-actions">
        <button
          type="button"
          class="button secondary"
          :disabled="busy"
          @click="emit('close')"
        >
          취소
        </button>
        <button class="button primary" :disabled="busy">
          {{ busy ? "등록 중…" : "관리자 등록하기" }}
        </button>
      </div>
    </form>
  </Modal>
</template>
