import { CATALOG_STOREFRONTS } from "./album.js";
export function catalogQuery(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !["q", "country"].includes(k)) ||
    typeof input.q !== "string" ||
    !input.q.trim() ||
    Array.from(input.q.trim()).length > 200 ||
    !CATALOG_STOREFRONTS.includes(input.country)
  )
    throw Error("곡명·가수와 검색 국가를 확인해주세요.");
  return { q: input.q.trim(), country: input.country };
}
export function catalogUrl(input) {
  const { q, country } = catalogQuery(input),
    url = new URL("https://itunes.apple.com/search");
  for (const [key, value] of Object.entries({
    term: q,
    country,
    media: "music",
    entity: "song",
    limit: "10",
  }))
    url.searchParams.set(key, value);
  return url.href;
}
