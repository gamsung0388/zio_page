import { getProfile, saveProfile } from "../repositories/site-profile.js";
import { validateProfile } from "../../shared/site-profile.js";
import { ApiError, json, readJson } from "../utils/http.js";
export async function profileRoutes(request, env) {
  if (request.method === "GET") return json(await getProfile(env.DB));
  if (request.method === "PUT") {
    const { expected_revision, ...input } = await readJson(request);
    let profile;
    try {
      if (!Number.isSafeInteger(expected_revision) || expected_revision < 0)
        throw Error("설정 버전을 확인해주세요.");
      profile = validateProfile(input);
    } catch (e) {
      throw new ApiError(422, "PROFILE_INPUT", e.message);
    }
    if (profile.featured_ids.length) {
      const result = await env.DB.prepare(
        `SELECT id FROM songs WHERE deleted_at IS NULL AND is_public=1 AND id IN (${profile.featured_ids.map(() => "?").join(",")})`,
      )
        .bind(...profile.featured_ids)
        .all();
      if (result.results.length !== profile.featured_ids.length)
        throw new ApiError(
          422,
          "PROFILE_SONGS",
          "삭제되지 않은 공개 곡만 추천할 수 있어요.",
        );
    }
    const saved = await saveProfile(env.DB, profile, expected_revision);
    if (!saved)
      throw new ApiError(
        409,
        "PROFILE_CONFLICT",
        "다른 곳에서 설정이 변경됐어요. 입력을 보관한 뒤 최신 설정을 불러와주세요.",
      );
    return json(saved);
  }
  return null;
}
