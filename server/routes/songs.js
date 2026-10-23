import { songImageResponse } from "../services/song-images.js";
import {
  ApiError,
  json,
  readJson,
  readBody,
  positiveId,
} from "../utils/http.js";
import {
  parseFilters,
  validateSong,
  SONG_FIELDS,
} from "../services/song-validation.js";
import {
  validateSongMutation,
  songConflict,
} from "../services/song-mutations.js";
import {
  serialize,
  listSongs,
  getSong,
  createSong,
  updateSong,
  deleteSong,
} from "../repositories/songs.js";
import { CSV_MAX_BYTES, stringifyCSV } from "../services/csv.js";

import { validateBulk, bulkSongs } from "../services/song-bulk.js";
import { importCSV, previewCSVImport } from "../services/song-imports.js";

// Called only after requireAdmin has checked session, permissions, origin and CSRF.
export async function songRoutes(request, env, path, auth) {
  if (path === "/api/admin/songs/backup" && request.method === "GET") {
    const params = new URL(request.url).searchParams,
      raw = params.get("after");
    if (
      [...params.keys()].some((k) => k !== "after") ||
      params.getAll("after").length > 1 ||
      (raw !== null &&
        (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))))
    )
      throw new ApiError(400, "SONG_BACKUP", "백업 페이지를 확인해주세요.");
    const rows = (
      await env.DB.prepare(
        "SELECT * FROM songs WHERE deleted_at IS NULL AND id>? ORDER BY id LIMIT 101",
      )
        .bind(raw === null ? 0 : Number(raw))
        .all()
    ).results;
    return json({
      items: rows
        .slice(0, 100)
        .map((row) => serialize(row, { admin: true, includeImage: true })),
      next_after: rows.length > 100 ? rows[99].id : null,
    });
  }
  if (path === "/api/admin/songs/bulk" && request.method === "PATCH")
    return json(
      await bulkSongs(
        env.DB,
        validateBulk(await readJson(request)),
        auth.user.id,
      ),
    );
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
        await createSong(
          env.DB,
          validateSong(await readJson(request, 128 * 1024)),
          auth.user.id,
        ),
        201,
      );
  }
  if (path === "/api/admin/songs/export.csv" && request.method === "GET") {
    const result = await env.DB.prepare(
      `SELECT ${SONG_FIELDS.join(",")} FROM songs WHERE deleted_at IS NULL ORDER BY id`,
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
        ? previewCSVImport(env.DB, text, {
            owner: auth.user.id,
            key: request.headers.get("Idempotency-Key"),
          })
        : importCSV(env.DB, text, {
            owner: auth.user.id,
            key: request.headers.get("Idempotency-Key"),
            previewToken: request.headers.get("X-CSV-Preview"),
            confirmed: request.headers.get("X-CSV-Duplicates"),
          })),
    );
  }
  const imageMatch = path.match(/^\/api\/admin\/songs\/([1-9]\d*)\/cover$/);
  if (imageMatch && request.method === "GET")
    return songImageResponse(env.DB, imageMatch[1], true);
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
        await readJson(request, 128 * 1024),
      );
      const song = await updateSong(
        env.DB,
        id,
        changes,
        revision,
        auth.user.id,
      );
      if (!song) songConflict();
      return json(song);
    }
    if (request.method === "DELETE") {
      const { revision } = validateSongMutation(await readJson(request), true);
      if (!(await deleteSong(env.DB, id, revision, auth.user.id)))
        songConflict();
      return json({ ok: true });
    }
  }

  return null;
}
