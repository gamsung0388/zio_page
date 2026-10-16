import {
  ALIGN_OPTIONS,
  DAY_OPTIONS,
  DEFAULT_EDITOR_OPTIONS,
  DEFAULT_TEMPLATE,
  FONT_SIZE_LIMITS,
  TEMPLATE_MAP,
} from "./scheduleConfig.js";

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTemplate(value) {
  return Object.hasOwn(TEMPLATE_MAP, value) ? value : DEFAULT_TEMPLATE;
}

export function isValidEditorOption(key, value) {
  if (Object.hasOwn(FONT_SIZE_LIMITS, key)) return Number.isFinite(value);
  if (key === "textColor")
    return typeof value === "string" && /^#[\da-f]{6}$/i.test(value);
  if (key === "align")
    return ALIGN_OPTIONS.some((option) => option.value === value);
  if (key === "bold" || key === "hideColon") return typeof value === "boolean";
  return false;
}

export function createEditorOptions(options = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_EDITOR_OPTIONS).map(([key, fallback]) => {
      const value = options?.[key];
      if (!isValidEditorOption(key, value)) return [key, fallback];
      const limits = FONT_SIZE_LIMITS[key];
      return [
        key,
        limits
          ? Math.min(limits.max, Math.max(limits.min, Math.round(value)))
          : value,
      ];
    }),
  );
}

export function createScheduleForm(form = {}) {
  return Object.fromEntries(
    DAY_OPTIONS.map(({ key }) => [
      key,
      {
        content:
          typeof form?.[key]?.content === "string" ? form[key].content : "",
        time: typeof form?.[key]?.time === "string" ? form[key].time : "",
      },
    ]),
  );
}
