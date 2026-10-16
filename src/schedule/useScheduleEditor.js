import { reactive, ref, computed, onBeforeUnmount } from "vue";
import { api } from "../services/api.js";
import { notify } from "../services/notifications.js";
import { useEditorDraft } from "../services/useEditorDraft.js";
import { useEditorGuard } from "../services/editor-guards.js";
import { DEFAULT_TEMPLATE } from "../../shared/schedule/scheduleConfig.js";
import {
  createScheduleForm,
  createEditorOptions,
  normalizeTemplate,
  isValidEditorOption,
} from "../../shared/schedule/scheduleFactory.js";
import { schedulePayload } from "../../shared/schedule/validation.js";
export function useScheduleEditor(week) {
  const selectedTemplate = ref(DEFAULT_TEMPLATE),
    scheduleForm = reactive(createScheduleForm()),
    editorOptions = reactive(createEditorOptions());
  const loading = ref(true),
    saving = ref(false),
    error = ref(""),
    actionError = ref(""),
    notice = ref(""),
    revision = ref(0),
    lastSaved = ref(null),
    baseline = ref("");
  let controller;
  function snapshot() {
    return {
      selectedTemplate: selectedTemplate.value,
      scheduleForm: JSON.parse(JSON.stringify(scheduleForm)),
      editorOptions: { ...editorOptions },
    };
  }
  const dirty = computed(
    () =>
      Boolean(baseline.value) && JSON.stringify(snapshot()) !== baseline.value,
  );
  function apply(value) {
    const data = schedulePayload(value);
    selectedTemplate.value = data.selectedTemplate;
    Object.assign(scheduleForm, createScheduleForm(data.scheduleForm));
    Object.assign(editorOptions, createEditorOptions(data.editorOptions));
  }
  const drafts = useEditorDraft({
    scope: computed(() => "schedule:" + week.value),
    ready: computed(() => !loading.value && !error.value),
    dirty,
    snapshot: () => ({ ...snapshot(), revision: revision.value }),
    validate(value) {
      try {
        schedulePayload(value);
        return Number.isSafeInteger(value.revision) && value.revision >= 0;
      } catch {
        return false;
      }
    },
    apply(value) {
      apply(value);
      revision.value = value.revision;
      notice.value =
        "초안을 복구했어요. 내용을 확인하고 일정 저장을 눌러주세요.";
    },
  });
  useEditorGuard(() => dirty.value || saving.value);
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const request = controller;
    loading.value = true;
    error.value = "";
    notice.value = "";
    actionError.value = "";
    try {
      const data = await api("/admin/schedules/" + week.value, {
        signal: request.signal,
      });
      if (request !== controller) return;
      apply(data);
      revision.value = data.revision;
      lastSaved.value = data.updated_at;
      baseline.value = JSON.stringify(snapshot());
    } catch (err) {
      if (err.name !== "AbortError") error.value = err.message;
    } finally {
      if (request === controller) loading.value = false;
    }
  }
  async function save() {
    if (saving.value) return;
    saving.value = true;
    notice.value = "일정을 저장하고 있어요.";
    actionError.value = "";
    const data = snapshot();
    try {
      const result = await api("/admin/schedules/" + week.value, {
        method: "PUT",
        body: { ...data, expected_revision: revision.value },
      });
      revision.value = result.revision;
      lastSaved.value = result.updated_at;
      baseline.value = JSON.stringify(data);
      drafts.clear();
      notice.value = "일정을 저장했습니다.";
      notify(notice.value);
    } catch (err) {
      notice.value = "";
      actionError.value = err.message;
    } finally {
      saving.value = false;
    }
  }
  function confirmLeave() {
    if (
      dirty.value &&
      !window.confirm("저장하지 않은 일정 변경이 있어요. 이 페이지를 나갈까요?")
    )
      return false;
    drafts.clear();
    return true;
  }
  function reload() {
    if (
      !dirty.value ||
      window.confirm("입력 내용을 버리고 저장된 일정을 불러올까요?")
    ) {
      drafts.clear();
      return load();
    }
  }
  function updateDayField(day, field, value) {
    if (
      Object.hasOwn(scheduleForm, day) &&
      ["content", "time"].includes(field) &&
      typeof value === "string"
    )
      scheduleForm[day][field] = value;
  }
  function updateSelectedTemplate(value) {
    selectedTemplate.value = normalizeTemplate(value);
  }
  function updateEditorOption(key, value) {
    if (isValidEditorOption(key, value))
      Object.assign(
        editorOptions,
        createEditorOptions({ ...editorOptions, [key]: value }),
      );
  }
  function toggleOption(key) {
    if (["bold", "hideColon"].includes(key))
      editorOptions[key] = !editorOptions[key];
  }
  function resetSchedule() {
    if (
      window.confirm(
        "이 주의 입력 내용을 비울까요? 저장하기 전까지 기존 일정은 유지됩니다.",
      )
    )
      Object.assign(scheduleForm, createScheduleForm());
  }
  function resetAll() {
    if (window.confirm("이 주의 템플릿·글자 옵션·내용을 초기화할까요?"))
      apply({
        selectedTemplate: DEFAULT_TEMPLATE,
        scheduleForm: createScheduleForm(),
        editorOptions: createEditorOptions(),
      });
  }
  onBeforeUnmount(() => controller?.abort());
  return {
    selectedTemplate,
    scheduleForm,
    editorOptions,
    loading,
    saving,
    error,
    actionError,
    notice,
    dirty,
    revision,
    lastSaved,
    drafts,
    snapshot,
    apply,
    load,
    save,
    reload,
    confirmLeave,
    updateDayField,
    updateSelectedTemplate,
    updateEditorOption,
    toggleOption,
    resetSchedule,
    resetAll,
  };
}
