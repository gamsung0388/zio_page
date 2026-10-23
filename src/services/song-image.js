import {
  COVER_MAX_BYTES,
  COVER_MAX_DIMENSION,
  validateCoverImage,
} from "../../shared/song-image.js";
export const COVER_FILE_MAX_BYTES = 10 * 1024 * 1024;
export async function prepareSongImage(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("JPG, PNG, WEBP 사진을 선택해주세요.");
  if (!file.size || file.size > COVER_FILE_MAX_BYTES)
    throw Error("10MB 이하 사진을 선택해주세요.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw Error("사진을 열 수 없어요. 다른 파일을 선택해주세요.");
  });
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 40000000
    )
      throw Error(
        "사진 크기가 너무 커요. 4천만 화소 이하 사진을 선택해주세요.",
      );
    const canvas = document.createElement("canvas"),
      context = canvas.getContext("2d");
    if (!context)
      throw Error("사진을 준비할 수 없어요. 브라우저를 새로 열어주세요.");
    for (const edge of [COVER_MAX_DIMENSION, 384, 256, 192]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.7, 0.5]) {
        const value = canvas.toDataURL("image/webp", quality);
        if (value.length <= 23 + Math.ceil(COVER_MAX_BYTES / 3) * 4)
          return validateCoverImage(value);
      }
    }
    throw Error("사진 용량을 줄이지 못했어요. 다른 사진을 선택해주세요.");
  } finally {
    bitmap.close();
  }
}
