import { ApiError } from "../utils/http.js";
export async function reserveCatalogSearch(db, now = Date.now()) {
  const window = Math.floor(now / 60000);
  const allowance = await db
    .prepare(
      "INSERT INTO catalog_limits(id,window_start,requests) VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET window_start=excluded.window_start,requests=CASE WHEN catalog_limits.window_start=excluded.window_start THEN catalog_limits.requests+1 ELSE 1 END WHERE catalog_limits.window_start<>excluded.window_start OR catalog_limits.requests<10 RETURNING requests",
    )
    .bind(window)
    .first();
  if (!allowance) {
    const error = new ApiError(
      429,
      "CATALOG_LIMIT",
      "앨범 검색을 잠시 쉬고 있어요. 1분 후 다시 시도해주세요.",
    );
    error.retryAfter = 60;
    throw error;
  }
}
