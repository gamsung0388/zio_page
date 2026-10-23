// Shared validation for API writes, drafts and portable backups.
export const COVER_MAX_BYTES = 32 * 1024;
export const COVER_MAX_DIMENSION = 512;
export const COVER_PREFIX = "data:image/webp;base64,";
export function coverBytes(value) {
  return Uint8Array.from(atob(value.slice(COVER_PREFIX.length)), (c) =>
    c.charCodeAt(0),
  );
}
export function validateCoverImage(value) {
  if (value === null) return null;
  const fail = () => {
    throw Error(
      "앨범 사진을 다시 선택해주세요. 저장용 WEBP 표지는 512px·32KB 이하여야 해요.",
    );
  };
  if (
    typeof value !== "string" ||
    value.length > COVER_PREFIX.length + Math.ceil(COVER_MAX_BYTES / 3) * 4 ||
    !value.startsWith(COVER_PREFIX)
  )
    fail();
  const base64 = value.slice(COVER_PREFIX.length);
  if (
    !base64 ||
    base64.length % 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      base64,
    )
  )
    fail();
  const bytes = coverBytes(value),
    view = new DataView(bytes.buffer);
  const tag = (at) => String.fromCharCode(...bytes.slice(at, at + 4));
  if (
    bytes.length < 26 ||
    bytes.length > COVER_MAX_BYTES ||
    tag(0) !== "RIFF" ||
    tag(8) !== "WEBP" ||
    view.getUint32(4, true) + 8 !== bytes.length
  )
    fail();
  let width = 0,
    height = 0,
    frames = 0,
    canvasWidth = 0,
    canvasHeight = 0;
  for (let at = 12; at < bytes.length;) {
    if (at + 8 > bytes.length) fail();
    const kind = tag(at),
      size = view.getUint32(at + 4, true),
      start = at + 8,
      end = start + size;
    if (end > bytes.length || ["ANIM", "ANMF"].includes(kind)) fail();
    if (kind === "VP8X") {
      if (size !== 10 || bytes[start] & 2 || canvasWidth) fail();
      canvasWidth =
        1 +
        bytes[start + 4] +
        (bytes[start + 5] << 8) +
        (bytes[start + 6] << 16);
      canvasHeight =
        1 +
        bytes[start + 7] +
        (bytes[start + 8] << 8) +
        (bytes[start + 9] << 16);
      if (
        canvasWidth > COVER_MAX_DIMENSION ||
        canvasHeight > COVER_MAX_DIMENSION
      )
        fail();
    }
    // Canvas output may carry its color profile; original EXIF/XMP and extra chunks are not accepted.
    if (
      !["VP8X", "ICCP", "ALPH", "VP8 ", "VP8L"].includes(kind) ||
      (size & 1 && bytes[end] !== 0)
    )
      fail();
    if (kind === "VP8 ") {
      if (
        size < 10 ||
        bytes[start + 3] !== 0x9d ||
        bytes[start + 4] !== 1 ||
        bytes[start + 5] !== 0x2a
      )
        fail();
      width = view.getUint16(start + 6, true) & 0x3fff;
      height = view.getUint16(start + 8, true) & 0x3fff;
      frames++;
    } else if (kind === "VP8L") {
      if (size < 5 || bytes[start] !== 0x2f) fail();
      width = 1 + bytes[start + 1] + ((bytes[start + 2] & 0x3f) << 8);
      height =
        1 +
        (bytes[start + 2] >> 6) +
        (bytes[start + 3] << 2) +
        ((bytes[start + 4] & 15) << 10);
      frames++;
    }
    at = end + (size & 1);
    if (at > bytes.length) fail();
  }
  if (
    frames !== 1 ||
    (canvasWidth && (canvasWidth !== width || canvasHeight !== height)) ||
    width < 1 ||
    height < 1 ||
    width > COVER_MAX_DIMENSION ||
    height > COVER_MAX_DIMENSION
  )
    fail();
  return value;
}
