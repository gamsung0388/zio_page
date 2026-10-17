// Only known protected application routes may be used as login destinations.
export function safeReturnTo(value) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return "";
  try {
    const url = new URL(value, "https://zio.invalid");
    if (
      !value.startsWith("/admin") ||
      url.origin !== "https://zio.invalid" ||
      url.hash
    )
      return "";
    if (
      !/^\/admin(?:\/(?:songs(?:\/new|\/guide|\/[1-9]\d*\/edit)?|users|menus|password-reset|password|schedule(?:\/(?:image|notes|guide))?))?$/.test(
        url.pathname,
      )
    )
      return "";
    // URL normalization must not turn traversal/encoded paths into a valid destination.
    if (value.split("?")[0] !== url.pathname) return "";
    return url.pathname + url.search;
  } catch {
    return "";
  }
}
