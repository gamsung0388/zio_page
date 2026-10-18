import { getAppearance } from "../repositories/appearance.js";
import { getNavigation } from "../repositories/navigation.js";
import { publicNavigation } from "../../shared/navigation.js";
import { json, positiveId, ApiError } from "../utils/http.js";
import { parseFilters } from "../services/song-validation.js";
import { listSongs, getSong } from "../repositories/songs.js";
export async function publicRoutes(request, env, path) {
  if (request.method !== "GET") return null;
  if (path === "/api/appearance")
    return json({ theme: (await getAppearance(env.DB)).theme });
  if (path === "/api/navigation")
    return json({
      items: publicNavigation((await getNavigation(env.DB)).items),
    });
  if (path === "/api/health") {
    if (new URL(request.url).searchParams.get("db") !== "1")
      return json({ ok: true, database: "not_checked" });
    try {
      await env.DB.prepare("SELECT 1 FROM songs LIMIT 1").first();
      return json({ ok: true, database: "ready" });
    } catch {
      return json({ ok: false, database: "unavailable" }, 503);
    }
  }
  if (path === "/api/songs")
    return json(
      await listSongs(env.DB, parseFilters(new URL(request.url).searchParams)),
    );
  const match = path.match(/^\/api\/songs\/([^/]+)$/);
  if (match) {
    const song = await getSong(env.DB, positiveId(match[1]));
    if (!song) throw new ApiError(404, "NOT_FOUND", "노래를 찾을 수 없습니다.");
    return json(song);
  }
  return null;
}
