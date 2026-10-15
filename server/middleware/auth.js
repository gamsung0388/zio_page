import { ApiError } from "../utils/http.js";
import { sha256, timingSafeEqual } from "../utils/crypto.js";
import { getSession } from "../repositories/auth.js";

export function checkOrigin(request) {
  const target = new URL(request.url);
  const origin = request.headers.get("Origin");
  const referer = request.headers.get("Referer");
  let source;
  try {
    source = origin || (referer ? new URL(referer).origin : "");
  } catch {
    source = "";
  }
  if (
    source !== target.origin ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  ) {
    throw new ApiError(403, "ORIGIN", "허용되지 않은 출처의 요청입니다.");
  }
}
export function sessionCookie(request, env, token, maxAge) {
  const url = new URL(request.url);
  const local =
    ["development", "test"].includes(env.APP_ENV) &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return `zio_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${local && url.protocol === "http:" ? "" : "; Secure"}`;
}
export async function requireAdmin(request, env) {
  const token = request.headers
    .get("Cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("zio_session="))
    ?.slice(12);
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new ApiError(401, "UNAUTHORIZED", "관리자 로그인이 필요합니다.");
  const tokenHash = await sha256(token);
  const user = await getSession(env.DB, tokenHash);
  if (!user)
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "세션이 만료되었습니다. 다시 로그인해주세요.",
    );
  const csrfToken = await sha256(`csrf:${token}`);
  if (!["GET", "HEAD"].includes(request.method)) {
    checkOrigin(request);
    if (
      !timingSafeEqual(request.headers.get("X-CSRF-Token") || "", csrfToken)
    ) {
      throw new ApiError(
        403,
        "CSRF",
        "보안 토큰을 확인할 수 없습니다. 페이지를 새로고침해주세요.",
      );
    }
  }
  if (
    user.must_change_password &&
    !["/api/admin/me", "/api/admin/logout", "/api/admin/password"].includes(
      new URL(request.url).pathname,
    )
  ) {
    throw new ApiError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "비밀번호를 변경한 뒤 관리자 기능을 사용할 수 있습니다.",
    );
  }
  return {
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      must_change_password: Boolean(user.must_change_password),
    },
    tokenHash,
    csrfToken,
  };
}
