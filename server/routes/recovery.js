import { json, readJson, ApiError, positiveId } from "../utils/http.js";
import {
  operationPage,
  revisionBody,
} from "../services/operation-validation.js";
import {
  recoveryList,
  historyList,
  restoreContent,
  purgeContent,
} from "../repositories/recovery.js";
export async function recoveryRoutes(request, env, path, auth) {
  const listing = path.match(
    /^\/api\/admin\/recovery\/(songs|events|history)$/,
  );
  if (listing && request.method === "GET") {
    const page = operationPage(new URL(request.url).searchParams);
    return json(
      await (listing[1] === "history"
        ? historyList(env.DB, page)
        : recoveryList(env.DB, listing[1], page)),
    );
  }
  const match = path.match(
    /^\/api\/admin\/recovery\/(songs|events)\/([1-9]\d*)(\/restore)?$/,
  );
  if (!match) return null;
  const restore = Boolean(match[3]);
  if (request.method !== (restore ? "POST" : "DELETE")) return null;
  const revision = revisionBody(await readJson(request)),
    id = positiveId(match[2]);
  const saved = await (restore ? restoreContent : purgeContent)(
    env.DB,
    match[1],
    id,
    revision,
    auth.user.id,
  );
  if (!saved)
    throw new ApiError(
      409,
      "RECOVERY_CONFLICT",
      "항목이 변경되거나 이미 처리됐어요. 목록을 새로고침해주세요.",
    );
  return json({
    ok: true,
    id,
    ...(restore && match[1] === "songs" ? { is_public: false } : {}),
  });
}
