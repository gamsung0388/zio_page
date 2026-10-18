<script setup>
import { ref } from "vue";
import Modal from "./Modal.vue";
import Icon from "./Icon.vue";
import ThemeChoices from "./ThemeChoices.vue";
import { THEME_OPTIONS } from "../../shared/appearance.js";
import { appearance, setThemePreference } from "../services/appearance.js";
const open = ref(false);
</script>
<template>
  <button
    class="theme-picker-trigger"
    aria-label="화면 테마 선택"
    @click="open = true"
  >
    <Icon name="leaf" :size="18" /><span>테마</span>
  </button>
  <Modal v-if="open" title="나의 음악 공간" @close="open = false">
    <p class="theme-dialog-intro">
      마음에 드는 분위기를 골라보세요.<br />이 브라우저에서만 적용돼요.
    </p>
    <ThemeChoices
      :model-value="appearance.preference"
      follow-site
      @update:model-value="setThemePreference"
    />
    <p class="theme-default-note">
      사이트 기본 테마:
      {{
        THEME_OPTIONS.find((theme) => theme.id === appearance.siteTheme)?.name
      }}
    </p>
    <p v-if="appearance.storageError" class="form-error" role="status">
      {{ appearance.storageError }}
    </p>
    <div class="theme-dialog-actions">
      <button class="button primary" @click="open = false">선택 완료</button>
    </div>
  </Modal>
</template>
