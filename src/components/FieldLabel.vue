<script setup>
import HelpTooltip from "./HelpTooltip.vue";
defineProps({
  forId: String,
  label: String,
  required: Boolean,
  help: String,
  badge: String,
});
</script>
<template>
  <div class="field-label-row">
    <component :is="forId ? 'label' : 'span'" :for="forId">{{
      label
    }}</component>
    <b v-if="required" aria-hidden="true">*</b>
    <small v-if="badge" class="private-indicator">{{ badge }}</small>
    <HelpTooltip v-if="help" :label="label" :text="help" />
  </div>
</template>
<style scoped>
.field-label-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 44px;
  margin-bottom: 3px;
}
.field-label-row > label,
.field-label-row > span {
  font-size: 13px;
  font-weight: 700;
  color: #344d37;
}
.field-label-row b {
  color: #a24b40;
}
.field-label-row .private-indicator {
  margin-left: 5px;
}
</style>
