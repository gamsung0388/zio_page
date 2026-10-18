<script setup>
import { useId } from "vue";
import { THEME_OPTIONS } from "../../shared/appearance.js";
defineProps({ modelValue: String, followSite: Boolean, disabled: Boolean });
const emit = defineEmits(["update:modelValue"]);
const id = useId();
</script>
<template>
  <fieldset class="theme-choices" :disabled="disabled">
    <legend class="sr-only">테마 선택</legend>
    <label
      v-if="followSite"
      class="theme-choice follow-site"
      :class="{ selected: modelValue === 'site' }"
    >
      <input
        type="radio"
        :name="id"
        value="site"
        :checked="modelValue === 'site'"
        @change="emit('update:modelValue', 'site')"
      />
      <span
        ><strong>사이트 기본값 따르기</strong
        ><small>지오가 정한 분위기를 함께 즐겨요</small></span
      >
    </label>
    <label
      v-for="theme in THEME_OPTIONS"
      :key="theme.id"
      class="theme-choice"
      :class="{ selected: modelValue === theme.id }"
    >
      <input
        type="radio"
        :name="id"
        :value="theme.id"
        :checked="modelValue === theme.id"
        @change="emit('update:modelValue', theme.id)"
      />
      <span class="theme-choice-copy"
        ><span class="theme-swatches" aria-hidden="true"
          ><i
            v-for="color in theme.colors"
            :key="color"
            :style="{ background: color }"
          ></i></span
        ><strong>{{ theme.name }}</strong
        ><small>{{ theme.description }}</small></span
      >
    </label>
  </fieldset>
</template>
