<script setup>
import { reactive, ref, computed, useId } from "vue";
import Modal from "./Modal.vue";
import {
  builtinMenu,
  validateMenuLink,
  MENU_AREAS,
} from "../../shared/navigation.js";
const props = defineProps({ item: Object });
const emit = defineEmits(["close", "apply"]);
const prefix = useId();
const form = reactive(
  props.item
    ? { ...props.item }
    : {
        id: "link-" + crypto.randomUUID(),
        label: "",
        area: "public",
        href: "",
        visible: true,
      },
);
const builtin = computed(() => builtinMenu(form.id));
const editableLink = computed(
  () => !builtin.value || builtin.value.id === "soop",
);
const error = ref("");
function apply() {
  if (!form.label.trim() || Array.from(form.label.trim()).length > 24) {
    error.value = "메뉴 이름은 1~24자로 입력해주세요.";
    return;
  }
  try {
    emit("apply", {
      ...form,
      label: form.label.trim(),
      href: editableLink.value
        ? validateMenuLink(form.href.trim())
        : builtin.value.href,
    });
  } catch (err) {
    error.value = err.message;
  }
}
</script>
<template>
  <Modal :title="item ? '메뉴 수정' : '새 링크 추가'" @close="emit('close')">
    <p class="modal-intro">
      {{
        item
          ? "메뉴 이름과 표시 위치를 정리해보세요."
          : "지오의 공간에 함께 둘 링크를 추가해보세요."
      }}
    </p>
    <form class="menu-link-form" @submit.prevent="apply">
      <label class="field" :for="prefix + '-label'"
        >메뉴 이름<input
          :id="prefix + '-label'"
          v-model="form.label"
          maxlength="24"
          placeholder="예: 지오의 유튜브"
          required
          autofocus
      /></label>
      <div v-if="editableLink" class="field">
        <label :for="prefix + '-href'">링크 주소</label
        ><input
          :id="prefix + '-href'"
          v-model="form.href"
          :aria-describedby="prefix + '-href-hint'"
          type="url"
          maxlength="2048"
          placeholder="https://"
          required
        /><small :id="prefix + '-href-hint'">링크는 새 창에서 열립니다.</small>
      </div>
      <div v-else class="menu-destination-note">
        연결할 곳 <strong>{{ builtin.targetLabel }}</strong>
      </div>
      <div v-if="!builtin" class="field">
        <label :for="prefix + '-area'">표시 위치</label
        ><select :id="prefix + '-area'" v-model="form.area">
          <option
            v-for="area in MENU_AREAS"
            :key="area.value"
            :value="area.value"
          >
            {{ area.label }}
          </option>
        </select>
      </div>
      <p v-if="!builtin" class="form-hint">
        {{ MENU_AREAS.find((area) => area.value === form.area)?.description }}
      </p>
      <p v-if="error" role="alert" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button type="button" class="button secondary" @click="emit('close')">
          취소</button
        ><button type="submit" class="button primary">편집에 적용</button>
      </div>
    </form>
  </Modal>
</template>
