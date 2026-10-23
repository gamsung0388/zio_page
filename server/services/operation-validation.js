import { ApiError } from "../utils/http.js";
export function revisionBody(body, extra = []) {
  if (
    Object.keys(body).some(
      (k) => !["expected_revision", ...extra].includes(k),
    ) ||
    !Number.isSafeInteger(body.expected_revision) ||
    body.expected_revision < 1
  )
    throw new ApiError(
      422,
      "OPERATION_REVISION",
      "현재 항목의 버전을 확인해주세요.",
    );
  return body.expected_revision;
}
export function operationPage(params) {
  if (
    [...params.keys()].some((k) => k !== "page") ||
    params.getAll("page").length > 1
  )
    throw new ApiError(400, "PAGE", "페이지 조건을 확인해주세요.");
  const raw = params.get("page") || "1";
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > 100000)
    throw new ApiError(400, "PAGE", "페이지 조건을 확인해주세요.");
  return Number(raw);
}
