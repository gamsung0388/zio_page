export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  });
}

export async function readBody(request, maxBytes = 64 * 1024) {
  if (Number(request.headers.get("Content-Length")) > maxBytes) {
    throw new ApiError(
      413,
      "TOO_LARGE",
      "요청 파일 또는 데이터가 너무 큽니다.",
    );
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const parts = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new ApiError(
        413,
        "TOO_LARGE",
        "요청 파일 또는 데이터가 너무 큽니다.",
      );
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ApiError(400, "ENCODING", "UTF-8 인코딩 파일을 사용해주세요.");
  }
}

export async function readJson(request, maxBytes) {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new ApiError(415, "CONTENT_TYPE", "JSON 형식으로 요청해주세요.");
  }
  try {
    const value = JSON.parse(await readBody(request, maxBytes));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "INVALID_JSON", "올바른 JSON 객체가 필요합니다.");
  }
}

export function positiveId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ApiError(404, "NOT_FOUND", "노래를 찾을 수 없습니다.");
  }
  return Number(value);
}
