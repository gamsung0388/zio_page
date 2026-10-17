import { ApiError } from "../utils/http.js";
import { validateSong } from "./song-validation.js";
import { validateRevision } from "./revisions.js";

export function validateSongMutation(input, deleting = false) {
  const revision = validateRevision(input?.expected_revision, {
    code: "SONG_REVISION",
    message:
      "노래 목록을 새로 불러온 뒤 다시 시도해주세요. 저장된 노래 버전이 필요합니다.",
  });
  const { expected_revision, ...fields } = input;
  if (deleting && Object.keys(fields).length)
    throw new ApiError(
      422,
      "SONG_REVISION",
      "삭제할 노래 버전만 전송해주세요.",
    );
  return { revision, changes: deleting ? null : validateSong(fields, true) };
}

export function songConflict() {
  throw new ApiError(
    409,
    "SONG_CONFLICT",
    "다른 관리자가 이 노래를 변경하거나 삭제했어요. 입력은 유지됩니다. 저장된 내용과 비교한 뒤 다시 저장해주세요.",
  );
}
