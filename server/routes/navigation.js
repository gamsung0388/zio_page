import { json, readJson, ApiError } from "../utils/http.js";
import { validateRevision } from "../services/revisions.js";
import { validateNavigation } from "../../shared/navigation.js";
import { getNavigation, saveNavigation } from "../repositories/navigation.js";
export async function navigationRoutes(request, env, path, auth) {
  if (path !== "/api/admin/navigation") return null;
  if (request.method === "GET") return json(await getNavigation(env.DB));
  if (request.method === "PUT") {
    const body = await readJson(request);
    if (
      Object.keys(body).some(
        (key) => !["items", "expected_revision"].includes(key),
      )
    )
      throw new ApiError(
        422,
        "NAVIGATION_VALIDATION",
        "메뉴 입력 항목을 확인해주세요.",
      );
    const revision = validateRevision(body.expected_revision, {
      code: "NAVIGATION_REVISION",
      message: "저장된 메뉴 버전을 확인해주세요.",
      min: 0,
    });
    let items;
    try {
      items = validateNavigation(body.items);
    } catch (error) {
      throw new ApiError(422, "NAVIGATION_VALIDATION", error.message);
    }
    const saved = await saveNavigation(env.DB, items, revision, auth.user.id);
    if (!saved)
      throw new ApiError(
        409,
        "NAVIGATION_CONFLICT",
        "다른 관리자가 메뉴를 변경했어요. 내 편집은 유지됩니다. 최신 설정을 확인한 뒤 다시 수정해주세요.",
      );
    return json(saved);
  }
  return null;
}
