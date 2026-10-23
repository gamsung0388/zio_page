import { validateCoverImage } from "../../shared/song-image.js";
import { validateAlbum } from "../../shared/album.js";
// Drafts may contain incomplete inputs; final submission still uses validateDraft/API validation.
export function isSongDraft(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.hasOwn(value, "album")) {
    try {
      validateAlbum(value.album);
    } catch {
      return false;
    }
  }
  try {
    if (Object.hasOwn(value, "coverImage"))
      validateCoverImage(value.coverImage);
  } catch {
    return false;
  }
  const strings = {
    title: 200,
    artist: 200,
    genre: 60,
    language: 40,
    description: 5000,
    privateMemo: 3000,
    cover: 2048,
  };
  const allowed = [
    ...Object.keys(strings),
    "level",
    "practiceStatus",
    "balloonCount",
    "isPublic",
    "links",
    "sourceUpdatedAt",
  ];
  if (
    Object.keys(value).some(
      (key) =>
        !allowed.includes(key) &&
        key !== "sourceRevision" &&
        key !== "album" &&
        key !== "coverImage",
    ) ||
    (Object.hasOwn(value, "sourceRevision") &&
      (!Number.isSafeInteger(value.sourceRevision) ||
        value.sourceRevision < 0)) ||
    allowed.some((key) => !Object.hasOwn(value, key))
  )
    return false;
  for (const [key, max] of Object.entries(strings))
    if (typeof value[key] !== "string" || Array.from(value[key]).length > max)
      return false;
  if (!Number.isInteger(value.level) || value.level < 0 || value.level > 5)
    return false;
  if (
    value.balloonCount !== "" &&
    !(
      typeof value.balloonCount === "number" &&
      Number.isFinite(value.balloonCount)
    )
  )
    return false;
  if (
    !["미연습", "연습중", "완료", "잠시 보류"].includes(value.practiceStatus) ||
    typeof value.isPublic !== "boolean"
  )
    return false;
  if (
    value.sourceUpdatedAt !== null &&
    (typeof value.sourceUpdatedAt !== "string" ||
      value.sourceUpdatedAt.length > 64)
  )
    return false;
  return (
    Array.isArray(value.links) &&
    value.links.length <= 20 &&
    value.links.every(
      (link) =>
        link &&
        typeof link === "object" &&
        !Array.isArray(link) &&
        Object.keys(link).every((key) => ["label", "url"].includes(key)) &&
        typeof link.label === "string" &&
        link.label.length <= 80 &&
        typeof link.url === "string" &&
        link.url.length <= 2048,
    )
  );
}
