import { reactive } from "vue";
export const session = reactive({ user: null, csrfToken: "", checked: false });
export async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (
    options.body &&
    !(options.body instanceof Blob) &&
    typeof options.body !== "string"
  ) {
    headers.set("Content-Type", "application/json");
    options = { ...options, body: JSON.stringify(options.body) };
  }
  if (session.csrfToken && !["GET", "HEAD"].includes(options.method || "GET"))
    headers.set("X-CSRF-Token", session.csrfToken);
  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(
      body?.error?.message || "요청에 실패했습니다. 잠시 후 다시 시도해주세요.",
    );
    Object.assign(error, {
      status: response.status,
      code: body?.error?.code,
      details: body?.error?.details || [],
    });
    if (response.status === 401 && path.startsWith("/admin/")) {
      session.user = null;
      session.csrfToken = "";
      window.dispatchEvent(
        new CustomEvent("zio-session-expired", { detail: path }),
      );
    }
    if (error.code === "PASSWORD_CHANGE_REQUIRED")
      window.dispatchEvent(new Event("zio-password-change-required"));
    throw error;
  }
  if (options.download) return response.blob();
  return response.json();
}
export async function checkSession() {
  try {
    const data = await api("/admin/me");
    Object.assign(session, data, { checked: true });
    return true;
  } catch (error) {
    if (error.status !== 401) throw error;
    session.checked = true;
    return false;
  }
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
