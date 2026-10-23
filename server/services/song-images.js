import { ApiError, positiveId } from "../utils/http.js";
import { coverBytes } from "../../shared/song-image.js";
export async function songImageResponse(db, id, admin = false) {
  const row = await db
    .prepare(
      "SELECT cover_image FROM songs WHERE id=? AND deleted_at IS NULL" +
        (admin ? "" : " AND is_public=1"),
    )
    .bind(positiveId(id))
    .first();
  if (!row?.cover_image)
    throw new ApiError(404, "NOT_FOUND", "앨범 사진을 찾을 수 없습니다.");
  return new Response(coverBytes(row.cover_image), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Referrer-Policy": "same-origin",
    },
  });
}
