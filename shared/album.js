export const CATALOG_STOREFRONTS = Object.freeze(["US", "KR", "JP"]);
const fields = [
  "provider",
  "track_id",
  "storefront",
  "title",
  "artist",
  "album_title",
  "artwork_url",
  "source_url",
];
function safeUrl(value, image = false) {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    /[\s\u0000-\u001f\u007f]/.test(value)
  )
    throw Error("앨범 주소를 확인해주세요.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw Error("안전한 앨범 주소가 필요합니다.");
  if (
    image
      ? !/^is[1-9]\d*(?:-ssl)?\.mzstatic\.com$/.test(url.hostname)
      : !["music.apple.com", "itunes.apple.com"].includes(url.hostname)
  )
    throw Error("지원하는 음원 제공처의 주소를 사용해주세요.");
  return url.href;
}
export function validateAlbum(value) {
  if (value === null) return null;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !fields.includes(k)) ||
    fields.some((k) => !Object.hasOwn(value, k))
  )
    throw Error("앨범 연결 정보를 확인해주세요.");
  if (
    value.provider !== "itunes" ||
    !Number.isSafeInteger(value.track_id) ||
    value.track_id < 1 ||
    !CATALOG_STOREFRONTS.includes(value.storefront)
  )
    throw Error("지원하는 앨범 후보를 다시 선택해주세요.");
  for (const key of ["title", "artist", "album_title"])
    if (
      typeof value[key] !== "string" ||
      !value[key].trim() ||
      Array.from(value[key]).length > 300 ||
      /[\u0000-\u001f]/.test(value[key])
    )
      throw Error("앨범 이름과 아티스트를 확인해주세요.");
  const artwork_url = safeUrl(value.artwork_url, true),
    source_url = safeUrl(value.source_url);
  if (new URL(source_url).searchParams.get("i") !== String(value.track_id))
    throw Error("앨범의 곡 식별자와 출처가 다릅니다.");
  return {
    provider: "itunes",
    track_id: value.track_id,
    storefront: value.storefront,
    title: value.title.trim(),
    artist: value.artist.trim(),
    album_title: value.album_title.trim(),
    artwork_url,
    source_url,
  };
}
export function catalogCandidates(data, storefront) {
  if (!data || !Array.isArray(data.results))
    throw Error("앨범 검색 응답을 확인할 수 없어요.");
  const seen = new Set(),
    items = [];
  for (const item of data.results) {
    if (
      item.wrapperType !== "track" ||
      item.kind !== "song" ||
      seen.has(item.trackId)
    )
      continue;
    try {
      const album = validateAlbum({
        provider: "itunes",
        track_id: item.trackId,
        storefront,
        title: item.trackName,
        artist: item.artistName,
        album_title: item.collectionName,
        artwork_url: item.artworkUrl100,
        source_url: item.trackViewUrl,
      });
      items.push(album);
      seen.add(item.trackId);
    } catch {}
    if (items.length === 10) break;
  }
  return items;
}
