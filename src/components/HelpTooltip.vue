<script setup>
import { ref, useId, nextTick, onMounted, onBeforeUnmount } from "vue";
defineProps({
  label: { type: String, required: true },
  text: { type: String, required: true },
});
const id = "help-" + useId(),
  trigger = ref(null),
  bubble = ref(null),
  open = ref(false),
  position = ref({});
let pinned = false,
  focused = false,
  leaveTimer;
async function show() {
  clearTimeout(leaveTimer);
  const firstOpen = !open.value;
  open.value = true;
  if (firstOpen) position.value = { visibility: "hidden" };
  await nextTick();
  if (!open.value || !trigger.value || !bubble.value) return;
  const rect = trigger.value.getBoundingClientRect(),
    box = bubble.value.getBoundingClientRect();
  const left = Math.max(
    12,
    Math.min(
      rect.left + rect.width / 2 - box.width / 2,
      innerWidth - box.width - 12,
    ),
  );
  const preferredTop =
    rect.bottom + box.height + 16 <= innerHeight
      ? rect.bottom + 8
      : rect.top - box.height - 8;
  const top = Math.max(
    12,
    Math.min(preferredTop, innerHeight - box.height - 12),
  );
  position.value = { left: left + "px", top: top + "px" };
}
function close() {
  clearTimeout(leaveTimer);
  open.value = false;
  pinned = false;
}
function hoverOut() {
  if (!pinned && !focused) leaveTimer = setTimeout(close, 150);
}
function keepOpen() {
  clearTimeout(leaveTimer);
}
function reposition() {
  if (open.value) show();
}
function focus() {
  focused = true;
  show();
}
function blur() {
  focused = false;
  if (!pinned) close();
}
function toggle() {
  if (pinned) close();
  else {
    pinned = true;
    show();
  }
}
function outside(event) {
  if (
    !trigger.value?.contains(event.target) &&
    !bubble.value?.contains(event.target)
  )
    close();
}
function escape(event) {
  if (open.value && event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    close();
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape, true);
  window.addEventListener("scroll", reposition, true);
  window.addEventListener("resize", reposition);
});
onBeforeUnmount(() => {
  clearTimeout(leaveTimer);
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", escape, true);
  window.removeEventListener("scroll", reposition, true);
  window.removeEventListener("resize", reposition);
});
</script>
<template>
  <span class="help-tooltip-anchor" @mouseenter="show" @mouseleave="hoverOut">
    <button
      ref="trigger"
      type="button"
      class="help-tooltip-trigger"
      :aria-label="label + ' 도움말'"
      :aria-describedby="open ? id : undefined"
      @focus="focus"
      @blur="blur"
      @click.stop.prevent="toggle"
    >
      <span aria-hidden="true">?</span>
    </button>
    <Teleport to="body"
      ><span
        v-if="open"
        :id="id"
        ref="bubble"
        class="help-tooltip-bubble"
        role="tooltip"
        :style="position"
        @mouseenter="keepOpen"
        @mouseleave="hoverOut"
        >{{ text }}</span
      ></Teleport
    >
  </span>
</template>
<style scoped>
.help-tooltip-anchor {
  display: inline-flex;
  vertical-align: middle;
  flex-shrink: 0;
}
.help-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #537449;
}
.help-tooltip-trigger > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 19px;
  height: 19px;
  border: 1px solid #779569;
  border-radius: 50%;
  background: #f5f8ef;
  font-size: 12px;
  font-weight: 750;
  line-height: 1;
}
.help-tooltip-trigger:hover > span {
  background: #e6f0dc;
  border-color: #315a38;
}
.help-tooltip-bubble {
  position: fixed;
  z-index: 3000;
  display: block;
  width: max-content;
  max-width: min(290px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow: auto;
  padding: 13px 16px;
  border-radius: 10px;
  background: #163d2b;
  color: #fff;
  box-shadow: 0 5px 20px #11372630;
  font-size: 13px;
  font-weight: 450;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
</style>
