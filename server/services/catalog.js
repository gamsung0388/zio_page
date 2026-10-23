import { catalogQuery, catalogUrl } from "../../shared/catalog-query.js";
import { reserveCatalogSearch } from "./catalog-limit.js";
import { ApiError } from "../utils/http.js";
import { catalogCandidates, validateAlbum } from "../../shared/album.js";
export async function searchCatalog(
  db,
  input,
  fetcher = fetch,
  now = Date.now(),
  { cache = true } = {},
) {
  try {
    input = catalogQuery(input);
  } catch (error) {
    throw new ApiError(422, "CATALOG_INPUT", error.message);
  }
  const q = input.q.trim(),
    country = input.country,
    key = country + ":" + q.toLowerCase();
  const cached = cache
    ? await db
        .prepare(
          "SELECT payload FROM catalog_cache WHERE cache_key=? AND expires_at>?",
        )
        .bind(key, now)
        .first()
    : null;
  if (cached) {
    try {
      return { items: JSON.parse(cached.payload).map(validateAlbum), country };
    } catch {}
  }
  await reserveCatalogSearch(db, now);
  const url = new URL(catalogUrl(input));
  let items;
  try {
    const response = await fetcher(url.href, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
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
  if (cache)
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
