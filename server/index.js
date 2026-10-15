import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";
import { ApiError, json } from "./utils/http.js";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path !== "/api" && !path.startsWith("/api/"))
      return env.ASSETS.fetch(request);
    try {
      const response =
        (await publicRoutes(request, env, path)) ||
        (await adminRoutes(request, env, path));
      return (
        response ||
        json(
          {
            error: {
              code: "NOT_FOUND",
              message: "요청한 API를 찾을 수 없습니다.",
            },
          },
          404,
        )
      );
    } catch (error) {
      if (error instanceof ApiError)
        return json(
          {
            error: {
              code: error.code,
              message: error.message,
              ...(error.details ? { details: error.details } : {}),
            },
          },
          error.status,
          error.status === 429 ? { "Retry-After": "900" } : {},
        );
      // Do not log SQL parameters, credentials, cookies, or stack traces.
      console.error("API: storage_or_internal_failure");
      return json(
        {
          error: {
            code: "SERVICE_UNAVAILABLE",
            message: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          },
        },
        503,
      );
    }
  },
};
