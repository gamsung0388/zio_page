import {
  ApiError,
  json,
  readJson,
  readBody,
  positiveId,
} from "../utils/http.js";
import { parseFilters, validateSong } from "../services/song-validation.js";
import {
  validateSongMutation,
  songConflict,
} from "../services/song-mutations.js";
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

// Called only after requireAdmin has checked session, permissions, origin and CSRF.
export async function songRoutes(request, env, path) {
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
      const { changes, revision } = validateSongMutation(
        await readJson(request),
      );
      const song = await updateSong(env.DB, id, changes, revision);
      if (!song) songConflict();
      return json(song);
    }
    if (request.method === "DELETE") {
      const { revision } = validateSongMutation(await readJson(request), true);
      if (!(await deleteSong(env.DB, id, revision))) songConflict();
      return json({ ok: true });
    }
  }

  return null;
}
