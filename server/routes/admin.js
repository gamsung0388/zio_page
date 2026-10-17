import { eventRoutes } from "./schedule-events.js";
import { scheduleRoutes } from "./schedules.js";
import { registerAdmin } from "../services/admin-users.js";
import { listAdmins } from "../repositories/admin-users.js";
import { resetPassword, changePassword } from "../services/passwords.js";
import {
  ApiError,
  json,
  readJson,
  readBody,
  positiveId,
} from "../utils/http.js";
import {
  checkOrigin,
  requireAdmin,
  sessionCookie,
} from "../middleware/auth.js";
import { login } from "../services/auth.js";
import { deleteSession } from "../repositories/auth.js";
import { parseFilters, validateSong } from "../services/song-validation.js";
import {
  listSongs,
  getSong,
  createSong,
  updateSong,
  deleteSong,
} from "../repositories/songs.js";
import {
  CSV_MAX_BYTES,
  previewCSV,
  importCSV,
  stringifyCSV,
} from "../services/csv.js";

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
  if (path === "/api/admin/songs") {
    if (request.method === "GET")
      return json(
        await listSongs(
          env.DB,
          parseFilters(new URL(request.url).searchParams, true),
          true,
        ),
      );
    if (request.method === "POST")
      return json(
        await createSong(env.DB, validateSong(await readJson(request))),
        201,
      );
  }
  if (path === "/api/admin/songs/export.csv" && request.method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM songs ORDER BY id",
    ).all();
    return new Response(stringifyCSV(result.results), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="zio-songs-${new Date().toISOString().slice(0, 10)}.csv"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (
    ["/api/admin/songs/import/preview", "/api/admin/songs/import"].includes(
      path,
    ) &&
    request.method === "POST"
  ) {
    if (
      !request.headers.get("Content-Type")?.toLowerCase().startsWith("text/csv")
    )
      throw new ApiError(
        415,
        "CONTENT_TYPE",
        "text/csv 형식으로 전송해주세요.",
      );
    const text = await readBody(request, CSV_MAX_BYTES);
    return json(
      await (path.endsWith("/preview")
        ? previewCSV(env.DB, text)
        : importCSV(env.DB, text)),
    );
  }
  const match = path.match(/^\/api\/admin\/songs\/(\d+)$/);
  if (match) {
    const id = positiveId(match[1]);
    if (request.method === "GET") {
      const song = await getSong(env.DB, id, true);
      if (!song)
        throw new ApiError(404, "NOT_FOUND", "노래를 찾을 수 없습니다.");
      return json(song);
    }
    if (request.method === "PATCH") {
      const song = await updateSong(
        env.DB,
        id,
        validateSong(await readJson(request), true),
      );
      if (!song)
        throw new ApiError(404, "NOT_FOUND", "노래를 찾을 수 없습니다.");
      return json(song);
    }
    if (request.method === "DELETE") {
      if (!(await deleteSong(env.DB, id)))
        throw new ApiError(404, "NOT_FOUND", "노래를 찾을 수 없습니다.");
      return json({ ok: true });
    }
  }
  return null;
}
