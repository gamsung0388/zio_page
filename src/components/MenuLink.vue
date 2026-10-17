<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import Icon from "./Icon.vue";
const props = defineProps({ item: Object, active: Boolean, preview: Boolean });
const bindings = computed(() =>
  props.preview
    ? { type: "button" }
    : props.item.external
      ? { href: props.item.href, target: "_blank", rel: "noopener noreferrer" }
      : { to: props.item.href, activeClass: "", exactActiveClass: "" },
);
const emit = defineEmits(["navigate", "close"]);
</script>
<template>
  <component
    :is="preview ? 'button' : item.external ? 'a' : RouterLink"
    v-bind="bindings"
    :class="{ active }"
    :aria-current="active ? 'page' : undefined"
    @click="
      preview
        ? emit('navigate', item.id === 'home' ? '#/' : '#/' + item.id)
        : emit('close')
    "
  >
    <Icon :name="item.icon" :size="19" /><span>{{ item.label }}</span
    ><span v-if="item.external" class="menu-external-mark" aria-hidden="true"
      >↗</span
    ><span v-if="item.external" class="sr-only"> (새 창)</span>
  </component>
</template>
