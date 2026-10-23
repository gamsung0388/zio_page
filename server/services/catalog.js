import { ApiError } from "../utils/http.js";
import {
  catalogCandidates,
  CATALOG_STOREFRONTS,
  validateAlbum,
} from "../../shared/album.js";
export async function searchCatalog(db, input, fetcher = fetch) {
  if (
    Object.keys(input).some((k) => !["q", "country"].includes(k)) ||
    typeof input.q !== "string" ||
    !input.q.trim() ||
    Array.from(input.q.trim()).length > 200 ||
    !CATALOG_STOREFRONTS.includes(input.country)
  )
    throw new ApiError(
      422,
      "CATALOG_INPUT",
      "곡명·가수와 검색 국가를 확인해주세요.",
    );
  const q = input.q.trim(),
    country = input.country,
    key = country + ":" + q.toLowerCase(),
    now = Date.now();
  const cached = await db
    .prepare(
      "SELECT payload FROM catalog_cache WHERE cache_key=? AND expires_at>?",
    )
    .bind(key, now)
    .first();
  if (cached) {
    try {
      return { items: JSON.parse(cached.payload).map(validateAlbum), country };
    } catch {}
  }
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
  const url = new URL("https://itunes.apple.com/search");
  for (const [k, v] of Object.entries({
    term: q,
    country,
    media: "music",
    entity: "song",
    limit: "10",
  }))
    url.searchParams.set(k, v);
  let items;
  try {
    const response = await fetcher(url.href, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw Error();
    const text = await response.text();
    if (text.length > 256000) throw Error();
    items = catalogCandidates(JSON.parse(text), country);
  } catch {
    throw new ApiError(
      503,
      "CATALOG_UNAVAILABLE",
      "앨범 검색이 잠시 어려워요. 연결 없이 노래를 저장할 수 있습니다.",
    );
  }
  await db.batch([
    db
      .prepare(
        "INSERT INTO catalog_cache(cache_key,payload,expires_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,expires_at=excluded.expires_at",
      )
      .bind(key, JSON.stringify(items), now + 600000),
    db.prepare(
      "DELETE FROM catalog_cache WHERE cache_key IN (SELECT cache_key FROM catalog_cache ORDER BY expires_at DESC LIMIT -1 OFFSET 100)",
    ),
  ]);
  return { items, country };
}
