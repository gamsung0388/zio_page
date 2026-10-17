<script setup>
import "../styles/management.css";
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { useNavigationEditor } from "../services/useNavigationEditor.js";
import { useEditorGuard } from "../services/editor-guards.js";
import {
  MENU_AREAS,
  builtinMenu,
  menuPresentation,
  moveMenu,
} from "../../shared/navigation.js";
import Icon from "../components/Icon.vue";
import Notice from "../components/Notice.vue";
import DraftRecovery from "../components/DraftRecovery.vue";
import MenuEditorDialog from "../components/MenuEditorDialog.vue";
const {
  items,
  dirty,
  busy,
  error,
  conflict,
  ready,
  load,
  save,
  reset,
  confirmLeave,
  drafts,
  loading,
  loadError,
} = useNavigationEditor();
const { pending, storageError } = drafts;
const editing = ref(null),
  adding = ref(false),
  previewArea = ref("public");
const groups = computed(() =>
  MENU_AREAS.map((area) => ({
    ...area,
    items: items.value
      .filter((item) => item.area === area.value)
      .map(menuPresentation),
  })),
);
const visible = computed(() => items.value.filter((item) => item.visible));
const newCount = computed(
  () => items.value.filter((item) => !builtinMenu(item.id)).length,
);
const previewItems = computed(
  () =>
    groups.value
      .find((area) => area.value === previewArea.value)
      ?.items.filter((item) => item.visible) || [],
);
useEditorGuard(
  () => dirty.value || busy.value || editing.value || adding.value,
);
onBeforeRouteLeave((to) =>
  ["/admin/login", "/admin/password"].includes(to.path)
    ? true
    : confirmLeave(Boolean(editing.value || adding.value)),
);
function apply(item) {
  if (editing.value)
    items.value = items.value.map((value) =>
      value.id === item.id ? item : value,
    );
  else items.value = [...items.value, item];
  editing.value = null;
  adding.value = false;
}
function remove(item) {
  if (
    builtinMenu(item.id) ||
    !window.confirm(
      "“" + item.label + "” 링크를 메뉴에서 삭제할까요? 저장 후 반영됩니다.",
    )
  )
    return;
  items.value = items.value.filter((value) => value.id !== item.id);
}
function toggle(item) {
  items.value = items.value.map((value) =>
    value.id === item.id ? { ...value, visible: !value.visible } : value,
  );
}
function move(item, direction) {
  items.value = moveMenu(items.value, item.id, direction);
}
function beforeUnload(event) {
  if (dirty.value || busy.value || editing.value || adding.value) {
    event.preventDefault();
    event.returnValue = "";
  }
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload));
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
</script>
<template>
  <div class="management-page menu-management-page">
    <div class="management-breadcrumb">
      <RouterLink to="/admin">관리</RouterLink
      ><Icon name="arrow" :size="13" /><span>메뉴 관리</span>
    </div>
    <header class="management-heading">
      <div>
        <span class="management-kicker">지오의 공간을 정리해요</span>
        <h1>메뉴 관리</h1>
        <p>필요한 메뉴를 보기 좋게, 자주 찾는 링크를 가까이에.</p>
      </div>
      <button
        class="button secondary"
        :disabled="!ready || busy || newCount >= 20"
        @click="adding = true"
      >
        <Icon name="plus" :size="18" />새 링크 추가
      </button>
    </header>
    <Notice
      :loading="loading"
      :error="loadError"
      loading-message="메뉴를 불러오고 있어요."
      @retry="load"
    />
    <template v-if="ready && !loading && !loadError">
      <DraftRecovery
        :pending="pending"
        :error="storageError"
        @restore="drafts.restore"
        @discard="drafts.clear"
      />
      <div class="menu-editor-layout">
        <div class="menu-editor-groups">
          <section
            v-for="group in groups"
            :key="group.value"
            class="menu-area-panel"
            :aria-label="group.label + ' 메뉴 편집'"
          >
            <div class="menu-area-heading">
              <div>
                <h2>
                  {{ group.label }} <span>{{ group.items.length }}</span>
                </h2>
                <p>{{ group.description }}</p>
              </div>
              <Icon
                :name="
                  group.value === 'work'
                    ? 'lock'
                    : group.value === 'footer'
                      ? 'external'
                      : 'home'
                "
                :size="20"
              />
            </div>
            <p v-if="!group.items.length" class="menu-area-empty">
              새 링크를 추가해 이곳에 둘 수 있어요.
            </p>
            <article
              v-for="(item, index) in group.items"
              :key="item.id"
              class="menu-edit-row"
              :class="{ 'is-hidden': !item.visible }"
            >
              <span class="menu-row-icon"
                ><Icon :name="item.icon" :size="20"
              /></span>
              <div class="menu-row-text">
                <h3>
                  {{ item.label }}
                  <span v-if="!item.visible" class="menu-hidden-label"
                    >숨김</span
                  >
                </h3>
                <p>{{ item.targetLabel }}</p>
              </div>
              <div class="menu-row-actions">
                <button
                  class="menu-visibility"
                  role="switch"
                  :aria-checked="item.visible"
                  :aria-label="item.label + ' 표시'"
                  :disabled="busy || item.id === 'home'"
                  @click="toggle(item)"
                >
                  <span></span
                  ><span class="sr-only">{{
                    item.visible ? "표시" : "숨김"
                  }}</span>
                </button>
                <div class="menu-order-buttons">
                  <button
                    :disabled="busy || index === 0"
                    :aria-label="item.label + ' 위로 이동'"
                    @click="move(item, -1)"
                  >
                    <Icon name="up" :size="16" /></button
                  ><button
                    :disabled="busy || index === group.items.length - 1"
                    :aria-label="item.label + ' 아래로 이동'"
                    @click="move(item, 1)"
                  >
                    <Icon name="down" :size="16" />
                  </button>
                </div>
                <button
                  class="menu-edit-button"
                  :disabled="busy"
                  :aria-label="item.label + ' 메뉴 수정'"
                  @click="editing = items.find((value) => value.id === item.id)"
                >
                  <Icon name="edit" :size="17" /><span>수정</span>
                </button>
                <button
                  v-if="!builtinMenu(item.id)"
                  class="menu-remove-button"
                  :disabled="busy"
                  :aria-label="item.label + ' 링크 삭제'"
                  @click="remove(item)"
                >
                  <Icon name="trash" :size="17" />
                </button>
              </div>
            </article>
          </section>
          <div class="menu-stable-note">
            <Icon name="lock" :size="18" />
            <p>
              <strong>관리 메뉴는 언제나 이 자리에</strong
              ><span
                >관리자 관리와 메뉴 관리는 숨김·삭제되지 않아요. 메뉴를 숨겨도
                페이지 자체의 공개 여부나 접근 권한은 바뀌지 않습니다.</span
              >
            </p>
          </div>
          <button
            class="text-button menu-reset"
            :disabled="busy"
            @click="reset"
          >
            기본 메뉴로 편집하기
          </button>
        </div>
        <aside class="menu-live-preview">
          <div class="menu-preview-intro">
            <span class="management-kicker">저장 전 미리보기</span>
            <h2>이렇게 보여요</h2>
            <p>이름과 순서를 바꾸면 바로 확인할 수 있어요.</p>
          </div>
          <div class="menu-preview-surface">
            <div class="menu-preview-brand">
              ZIO <span>HOME</span><small>지오의 작은 음악 공간</small>
            </div>
            <div
              class="menu-preview-tabs"
              role="group"
              aria-label="메뉴 미리보기 위치"
            >
              <button
                v-for="area in MENU_AREAS"
                :key="area.value"
                :aria-pressed="previewArea === area.value"
                @click="previewArea = area.value"
              >
                {{ area.label }}
              </button>
            </div>
            <ul aria-label="메뉴 미리보기">
              <li v-for="item in previewItems" :key="item.id">
                <Icon :name="item.icon" :size="18" /><span>{{
                  item.label
                }}</span
                ><span v-if="item.external" aria-hidden="true">↗</span>
              </li>
              <li v-if="!previewItems.length" class="preview-empty">
                표시할 메뉴가 없어요.
              </li>
            </ul>
          </div>
          <p class="menu-preview-footnote">
            표시 중 {{ visible.length }}개 · 새 링크 {{ newCount }}/20개
          </p>
        </aside>
      </div>
      <div class="menu-save-bar">
        <div>
          <span class="menu-save-dot" :class="{ 'is-dirty': dirty }"></span
          ><span>{{
            dirty ? "아직 저장하지 않은 변경이 있어요" : "저장된 메뉴와 같아요"
          }}</span>
        </div>
        <button
          class="button primary"
          :disabled="busy || !dirty || conflict"
          @click="save"
        >
          <Icon name="check" :size="18" />{{ busy ? "저장 중…" : "메뉴 저장" }}
        </button>
      </div>
      <div
        v-if="error"
        id="menu-save-error"
        class="form-error menu-save-error"
        role="alert"
        tabindex="-1"
      >
        <p>{{ error }}</p>
        <button
          v-if="conflict"
          class="button secondary"
          :disabled="busy"
          @click="load"
        >
          최신 설정 불러오기
        </button>
      </div>
    </template>
    <MenuEditorDialog
      v-if="editing || adding"
      :item="editing"
      @close="
        editing = null;
        adding = false;
      "
      @apply="apply"
    />
  </div>
</template>
