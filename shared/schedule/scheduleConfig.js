export const STORAGE_KEY = "zio-weekly-schedule";
export const SAVE_VERSION = 1;

export const DEFAULT_TEMPLATE = "images/schedule/zio-schedule-template.png";

export const DEFAULT_EDITOR_OPTIONS = Object.freeze({
  contentFontSize: 25,
  timeFontSize: 25,
  textColor: "#1f3f18",
  bold: true,
  align: "left",
  hideColon: false,
});

// 기준 레이아웃(1번 템플릿 기준으로 실측한 좌표, % 단위)
export const DEFAULT_LAYOUT = Object.freeze({
  contentLeft: 18.1,
  timeLeft: 67.35,
  startTop: 19.7,
  rowGap: 9.35,
  contentWidth: 47.9,
  timeWidth: 13.3,
  rowHeight: 8.1,
});

export const TEMPLATE_LIST = Object.freeze([
  {
    value: "images/schedule/zio-schedule-template.png",
    label: "기본 템플릿",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template2.png",
    label: "템플릿 2",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template3.png",
    label: "템플릿 3",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template4.png",
    label: "템플릿 4",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template5.png",
    label: "템플릿 5",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template6.png",
    label: "템플릿 6",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template7.png",
    label: "템플릿 7",
    layout: DEFAULT_LAYOUT,
  },
  {
    value: "images/schedule/zio-schedule-template8.png",
    label: "템플릿 8",
    layout: DEFAULT_LAYOUT,
  },
]);

export const TEMPLATE_MAP = Object.freeze(
  TEMPLATE_LIST.reduce((map, template) => {
    map[template.value] = template;
    return map;
  }, {}),
);

export const DAY_OPTIONS = Object.freeze([
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
  { key: "sun", label: "일" },
]);

export const EXPORT_OPTIONS = Object.freeze({
  png: { mimeType: "image/png", extension: "png", quality: undefined },
  jpeg: { mimeType: "image/jpeg", extension: "jpg", quality: 0.95 },
});

export const ALIGN_OPTIONS = Object.freeze([
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
]);

export const CANVAS_SIZE = Object.freeze({ width: 1672, height: 941 });

export const FONT_SIZE_LIMITS = Object.freeze({
  contentFontSize: { min: 16, max: 42 },
  timeFontSize: { min: 14, max: 36 },
});
