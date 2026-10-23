import { ApiError, json, readJson } from "../utils/http.js";
import { requireAdmin } from "../middleware/auth.js";
import { ALBUM_LAB_PATH, isAlbumLabOwner } from "../../shared/album-lab.js";
import { catalogQuery } from "../../shared/catalog-query.js";
import { reserveCatalogSearch } from "../services/catalog-limit.js";
import { searchCatalog } from "../services/catalog.js";
export function requireLabOwner(user) {
  if (!isAlbumLabOwner(user))
    throw new ApiError(404, "NOT_FOUND", "페이지를 찾을 수 없습니다.");
}
const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  Vary: "Cookie",
};
export async function albumLabPage(request, env, path) {
  if (path !== ALBUM_LAB_PATH && !path.startsWith(ALBUM_LAB_PATH + "/"))
    return null;
  try {
    const auth = await requireAdmin(request, env);
    requireLabOwner(auth.user);
    if (path !== ALBUM_LAB_PATH || !["GET", "HEAD"].includes(request.method))
      return new Response("페이지를 찾을 수 없습니다.", {
        status: 404,
        headers: privateHeaders,
      });
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(privateHeaders))
      headers.set(key, value);
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.mzstatic.com; font-src 'self'; connect-src 'self' https://itunes.apple.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    headers.set("X-Frame-Options", "DENY");
    return new Response(request.method === "HEAD" ? null : response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED")
    ) {
      const url = new URL(
        error.status === 401 ? "/admin/login" : "/admin/password",
        request.url,
      );
      url.searchParams.set("next", ALBUM_LAB_PATH);
      return new Response(null, {
        status: 302,
        headers: { ...privateHeaders, Location: url.href },
      });
    }
    if (error instanceof ApiError && error.status === 404)
      return new Response("페이지를 찾을 수 없습니다.", {
        status: 404,
        headers: privateHeaders,
      });
    throw error;
  }
}
export async function albumLabRoutes(request, env, path, auth) {
  requireLabOwner(auth.user);
  if (path === "/api/admin/album-lab" && request.method === "GET")
    return json(
      { enabled: true, provider: "itunes", persisted: false },
      200,
      privateHeaders,
    );
  if (
    !["/api/admin/album-lab/authorize", "/api/admin/album-lab/search"].includes(
      path,
    ) ||
    request.method !== "POST"
  )
    throw new ApiError(404, "NOT_FOUND", "요청한 API를 찾을 수 없습니다.");
  let input;
  try {
    input = catalogQuery(await readJson(request));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, "CATALOG_INPUT", error.message);
  }
  if (path.endsWith("/authorize")) {
    await reserveCatalogSearch(env.DB);
    return json(input, 200, privateHeaders);
  }
  let upstreamStatus = null;
  const start = Date.now();
  try {
    const data = await searchCatalog(
      env.DB,
      input,
      async (...args) => {
        const response = await fetch(...args);
        upstreamStatus = response.status;
        return response;
      },
      Date.now(),
      { cache: false },
    );
    return json(
      {
        ...data,
        ok: true,
        upstream_status: upstreamStatus,
        elapsed_ms: Date.now() - start,
      },
      200,
      privateHeaders,
    );
  } catch (error) {
    if (error.code !== "CATALOG_UNAVAILABLE") throw error;
    return json(
      {
        ok: false,
        items: [],
        country: input.country,
        upstream_status: upstreamStatus,
        elapsed_ms: Date.now() - start,
        message:
          upstreamStatus === 429
            ? "Apple이 홈페이지 서버의 검색 요청을 제한했어요. 브라우저 직접 방식도 시험해보세요."
            : upstreamStatus
              ? "음원 제공처에서 정상 응답을 받지 못했어요."
              : "음원 제공처에 연결하지 못했어요. 잠시 후 다시 시험해주세요.",
      },
      200,
      privateHeaders,
    );
  }
}
