import { api } from "./api.js";
import { catalogUrl } from "../../shared/catalog-query.js";
import { catalogCandidates } from "../../shared/album.js";
export async function testAlbumSearch(input, mode, signal) {
  if (mode === "worker")
    return api("/admin/album-lab/search", {
      method: "POST",
      body: input,
      signal,
    });
  const allowed = await api("/admin/album-lab/authorize", {
    method: "POST",
    body: input,
    signal,
  });
  const start = performance.now();
  try {
    const response = await fetch(catalogUrl(allowed), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
    });
    if (!response.ok)
      return {
        ok: false,
        items: [],
        upstream_status: response.status,
        elapsed_ms: Math.round(performance.now() - start),
        message:
          response.status === 429
            ? "Apple이 브라우저의 검색 요청을 제한했어요. 잠시 후 다시 시험해주세요."
            : "음원 제공처에서 정상 응답을 받지 못했어요.",
      };
    const text = await response.text();
    if (text.length > 256000) throw Error("response_size");
    const items = catalogCandidates(JSON.parse(text), allowed.country);
    return {
      ok: true,
      items,
      country: allowed.country,
      upstream_status: response.status,
      elapsed_ms: Math.round(performance.now() - start),
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      ok: false,
      items: [],
      upstream_status: null,
      elapsed_ms: Math.round(performance.now() - start),
      message:
        error.name === "TimeoutError"
          ? "음원 제공처의 응답 시간이 길어졌어요. 잠시 후 다시 시험해주세요."
          : "브라우저에서 연결하지 못했어요. 네트워크·CORS 설정 또는 제공처 응답을 확인해주세요.",
    };
  }
}
