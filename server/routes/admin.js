import { albumLabRoutes } from "./album-lab.js";
import { profileRoutes } from "./site-profile.js";
import { recoveryRoutes } from "./recovery.js";
import {
  changeAdminStatus,
  revokeAdminSessions,
} from "../services/admin-status.js";
// Album search is paused; stored links remain compatible with song edits/backups.
import { appearanceRoutes } from "./appearance.js";
import { navigationRoutes } from "./navigation.js";
import { songRoutes } from "./songs.js";
import { eventRoutes } from "./schedule-events.js";
import { scheduleRoutes } from "./schedules.js";
import { registerAdmin } from "../services/admin-users.js";
import { listAdmins } from "../repositories/admin-users.js";
import { resetPassword, changePassword } from "../services/passwords.js";
import { ApiError, json, readJson } from "../utils/http.js";
import {
  checkOrigin,
  requireAdmin,
  sessionCookie,
} from "../middleware/auth.js";
import { login } from "../services/auth.js";
import { deleteSession } from "../repositories/auth.js";

export async function adminRoutes(request, env, path) {
  if (!path.startsWith("/api/admin/")) return null;
  if (path === "/api/admin/login" && request.method === "POST") {
    checkOrigin(request);
    const result = await login(
      env.DB,
      await readJson(request),
      request.headers.get("CF-Connecting-IP") || "local",
    );
    return json({ user: result.user, csrfToken: result.csrfToken }, 200, {
      "Set-Cookie": sessionCookie(request, env, result.token, 7 * 86400),
    });
  }
  const auth = await requireAdmin(request, env);
  if (
    path === "/api/admin/album-lab" ||
    path.startsWith("/api/admin/album-lab/")
  )
    return albumLabRoutes(request, env, path, auth);
  if (path === "/api/admin/site") return profileRoutes(request, env);
  if (path.startsWith("/api/admin/recovery/"))
    return recoveryRoutes(request, env, path, auth);
  const accountAction = path.match(
    /^\/api\/admin\/users\/([1-9]\d*)\/(status|revoke-sessions)$/,
  );
  if (accountAction) {
    const id = Number(accountAction[1]);
    if (!Number.isSafeInteger(id))
      throw new ApiError(404, "NOT_FOUND", "관리자를 찾을 수 없습니다.");
    if (accountAction[2] === "status" && request.method === "PATCH")
      return json(
        await changeAdminStatus(
          env.DB,
          id,
          await readJson(request),
          auth.user.id,
        ),
      );
    if (accountAction[2] === "revoke-sessions" && request.method === "POST")
      return json(await revokeAdminSessions(env.DB, id, auth.user.id));
  }

  if (path === "/api/admin/catalog/search" && request.method === "POST")
    throw new ApiError(
      503,
      "CATALOG_PAUSED",
      "앨범 검색·연결은 준비 중이에요. 앨범 사진을 직접 등록해주세요.",
    );
  if (path === "/api/admin/appearance") return appearanceRoutes(request, env);
  if (path === "/api/admin/navigation")
    return navigationRoutes(request, env, path, auth);
  if (path === "/api/admin/songs" || path.startsWith("/api/admin/songs/"))
    return songRoutes(request, env, path, auth);
  if (
    path === "/api/admin/schedule-events" ||
    path.startsWith("/api/admin/schedule-events/")
  )
    return eventRoutes(request, env, path, auth);
  if (
    path === "/api/admin/schedules" ||
    path.startsWith("/api/admin/schedules/")
  )
    return scheduleRoutes(request, env, path, auth);
  if (path === "/api/admin/me" && request.method === "GET")
    return json({ user: auth.user, csrfToken: auth.csrfToken });
  if (path === "/api/admin/logout" && request.method === "POST") {
    await deleteSession(env.DB, auth.tokenHash);
    console.info("security: logout");
    return json({ ok: true }, 200, {
      "Set-Cookie": sessionCookie(request, env, "", 0),
    });
  }
  if (path === "/api/admin/users") {
    if (request.method === "POST")
      return json(await registerAdmin(env.DB, await readJson(request)), 201);
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const page = params.get("page") || "1",
        size = params.get("page_size") || "20";
      if (
        !/^[1-9]\d*$/.test(page) ||
        Number(page) > 100000 ||
        !/^[1-9]\d*$/.test(size) ||
        Number(size) > 100
      )
        throw new ApiError(
          400,
          "PAGINATION",
          "페이지 조건이 올바르지 않습니다.",
        );
      return json(await listAdmins(env.DB, Number(page), Number(size)));
    }
  }
  if (path === "/api/admin/password" && request.method === "PATCH") {
    const result = await changePassword(
      env.DB,
      auth.user.id,
      await readJson(request),
    );
    return json(result, 200, {
      "Set-Cookie": sessionCookie(request, env, "", 0),
    });
  }
  const resetMatch = path.match(
    /^\/api\/admin\/users\/([1-9]\d*)\/reset-password$/,
  );
  if (resetMatch && request.method === "POST") {
    const id = Number(resetMatch[1]);
    if (!Number.isSafeInteger(id))
      throw new ApiError(404, "NOT_FOUND", "관리자를 찾을 수 없습니다.");
    const result = await resetPassword(env.DB, id);
    const self = id === auth.user.id;
    return json(
      { ...result, logged_out: self },
      200,
      self ? { "Set-Cookie": sessionCookie(request, env, "", 0) } : {},
    );
  }
  return null;
}
