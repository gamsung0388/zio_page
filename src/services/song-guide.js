import { safeReturnTo } from "./return-to.js";

// Guide links may return only to the song list or its real admin editor.
export function songGuideReturnTo(value, admin = false) {
  const fallback = admin ? "/admin/songs" : "/songs";
  if (admin) {
    const target = safeReturnTo(value);
    return /^\/admin\/songs(?:\/new|\/[1-9]\d*\/edit)?(?:\?|$)/.test(target)
      ? target
      : fallback;
  }
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://zio.invalid");
    return value.startsWith("/songs") &&
      url.origin === "https://zio.invalid" &&
      url.pathname === "/songs" &&
      value.split("?")[0] === url.pathname &&
      !url.hash
      ? url.pathname + url.search
      : fallback;
  } catch {
    return fallback;
  }
}

export function songGuideLink(source, admin = false) {
  return {
    path: admin ? "/admin/songs/guide" : "/songs/guide",
    query: { returnTo: songGuideReturnTo(source, admin) },
  };
}
