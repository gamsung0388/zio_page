import { computed, reactive } from "vue";
import { api } from "./api.js";
import {
  DEFAULT_THEME,
  isTheme,
  resolveTheme,
} from "../../shared/appearance.js";
const PREFERENCE_KEY = "zio:theme:preference:v1";
const SITE_KEY = "zio:theme:site:v1";
function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
const cached = read(SITE_KEY),
  preference = read(PREFERENCE_KEY);
export const appearance = reactive({
  siteTheme: isTheme(cached) ? cached : DEFAULT_THEME,
  preference: isTheme(preference) ? preference : "site",
  preview: null,
  storageError: "",
});
export const currentTheme = computed(() =>
  resolveTheme(appearance.preference, appearance.siteTheme, appearance.preview),
);
export function renderTheme() {
  document.documentElement.dataset.theme = currentTheme.value;
}
function persist(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
export function setSiteTheme(theme) {
  if (!isTheme(theme)) return;
  generation++;
  appearance.siteTheme = theme;
  persist(SITE_KEY, theme);
  renderTheme();
}
export function setThemePreference(value) {
  if (value !== "site" && !isTheme(value)) return;
  appearance.preference = value;
  appearance.preview = null;
  appearance.storageError = persist(PREFERENCE_KEY, value)
    ? ""
    : "이 브라우저에서 선택을 저장하지 못했어요. 현재 화면에는 적용됩니다.";
  renderTheme();
}
export function previewTheme(value) {
  appearance.preview = isTheme(value) ? value : null;
  renderTheme();
}
let loading,
  generation = 0;
export function loadSiteTheme() {
  if (!loading) {
    const started = generation;
    loading = api("/appearance")
      .then((data) => {
        if (started === generation) setSiteTheme(data.theme);
      })
      .catch(() => {})
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}
export function startAppearance() {
  renderTheme();
  window.addEventListener("storage", (event) => {
    if (event.key === PREFERENCE_KEY || event.key === null) {
      const value = read(PREFERENCE_KEY);
      appearance.preference = isTheme(value) ? value : "site";
    }
    if (event.key === SITE_KEY || event.key === null) {
      const value = read(SITE_KEY);
      if (isTheme(value)) {
        generation++;
        appearance.siteTheme = value;
      }
    }
    renderTheme();
  });
  loadSiteTheme();
}
