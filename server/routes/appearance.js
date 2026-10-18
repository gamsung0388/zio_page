import { json, readJson, ApiError } from "../utils/http.js";
import { validateRevision } from "../services/revisions.js";
import { validateAppearance } from "../../shared/appearance.js";
import { getAppearance, saveAppearance } from "../repositories/appearance.js";
export async function appearanceRoutes(request, env) {
  if (request.method === "GET") return json(await getAppearance(env.DB));
  if (request.method !== "PUT") return null;
  const body = await readJson(request);
  if (
    Object.keys(body).some(
      (key) => !["theme", "expected_revision"].includes(key),
    )
  )
    throw new ApiError(
      422,
      "APPEARANCE_VALIDATION",
      "테마 설정 항목을 확인해주세요.",
    );
  const revision = validateRevision(body.expected_revision, {
    code: "APPEARANCE_REVISION",
    message: "저장된 테마 버전을 확인해주세요.",
    min: 0,
  });
  let appearance;
  try {
    appearance = validateAppearance({ theme: body.theme });
  } catch (error) {
    throw new ApiError(422, "APPEARANCE_VALIDATION", error.message);
  }
  const saved = await saveAppearance(env.DB, appearance, revision);
  if (!saved)
    throw new ApiError(
      409,
      "APPEARANCE_CONFLICT",
      "다른 관리자가 테마를 변경했어요. 최신 설정을 불러온 후 다시 선택해주세요.",
    );
  return json(saved);
}
