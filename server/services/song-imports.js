import { ApiError } from "../utils/http.js";
import { randomToken, sha256 } from "../utils/crypto.js";
import { inspectCSV, previewCSV } from "./csv.js";
import {
  commitSongImport,
  findImportJob,
} from "../repositories/song-imports.js";

function previousResult(job, hash) {
  if (!job) return null;
  if (job.body_hash !== hash)
    throw new ApiError(
      409,
      "CSV_IMPORT_KEY_REUSED",
      "다른 파일에 사용한 등록 번호예요. 파일을 다시 선택해주세요.",
    );
  return { ...JSON.parse(job.result_json), replayed: true };
}

function changed(preview) {
  throw new ApiError(
    409,
    "CSV_PREVIEW_CHANGED",
    "미리보기 이후 노래 목록이 바뀌었어요. 새 중복 안내를 확인한 뒤 다시 추가해주세요.",
    { preview },
  );
}

export async function importCSV(
  db,
  text,
  { owner, key, previewToken, confirmed },
) {
  if (!Number.isSafeInteger(owner) || owner < 1)
    throw new ApiError(401, "UNAUTHORIZED", "관리자 로그인이 필요합니다.");
  if (typeof key !== "string" || !/^[A-Za-z0-9._-]{16,80}$/.test(key))
    throw new ApiError(
      422,
      "CSV_IMPORT_KEY",
      "등록 번호를 확인할 수 없어요. 화면을 새로고침한 뒤 파일을 다시 선택해주세요.",
    );
  if (typeof previewToken !== "string" || !/^[a-f0-9]{64}$/.test(previewToken))
    throw new ApiError(
      422,
      "CSV_PREVIEW_REQUIRED",
      "파일 미리보기와 검증을 먼저 진행해주세요.",
    );
  const bodyHash = await sha256(text);
  const existing = previousResult(
    await findImportJob(db, owner, key),
    bodyHash,
  );
  if (existing) return existing;
  const inspection = await inspectCSV(db, text);
  const { preview } = inspection;
  if (!preview.can_import)
    throw new ApiError(
      422,
      "CSV_VALIDATION",
      "오류가 있어 등록하지 않았습니다. CSV를 수정해주세요.",
      preview.errors,
    );
  if (preview.preview_token !== previewToken) changed(preview);
  if (preview.warnings.length && confirmed !== "yes")
    throw new ApiError(
      409,
      "CSV_DUPLICATES_REQUIRED",
      "중복 곡을 별도로 추가할지 확인해주세요.",
      { preview },
    );
  try {
    const result = await commitSongImport(db, {
      owner,
      key,
      bodyHash,
      claim: randomToken(),
      ...inspection,
    });
    if (result) return { ...result, replayed: false };
  } catch (error) {
    const replay = previousResult(
      await findImportJob(db, owner, key),
      bodyHash,
    );
    if (replay) return replay;
    throw error;
  }
  const replay = previousResult(await findImportJob(db, owner, key), bodyHash);
  if (replay) return replay;
  changed((await inspectCSV(db, text)).preview);
}

// A lost response may be recovered after closing and reopening the import dialog.
export async function previewCSVImport(db, text, { owner, key }) {
  if (key) {
    if (!/^[A-Za-z0-9._-]{16,80}$/.test(key))
      throw new ApiError(
        422,
        "CSV_IMPORT_KEY",
        "화면을 새로고침한 뒤 파일을 다시 선택해주세요.",
      );
    const replay = previousResult(
      await findImportJob(db, owner, key),
      await sha256(text),
    );
    if (replay) return { completed: replay };
  }
  return previewCSV(db, text);
}
