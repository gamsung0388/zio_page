import { ApiError } from "../utils/http.js";

// Shared integer contract; each resource keeps its own error code and wording.
export function validateRevision(value, { code, message, min = 1 }) {
  if (!Number.isSafeInteger(value) || value < min)
    throw new ApiError(422, code, message);
  return value;
}
