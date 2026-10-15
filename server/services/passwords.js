import { ApiError } from "../utils/http.js";
import {
  hashPassword,
  PASSWORD_ITERATIONS,
  randomToken,
  sha256,
  timingSafeEqual,
} from "../utils/crypto.js";
import { reserveLoginAttempt } from "../repositories/auth.js";
import {
  findAdminById,
  resetAdminPassword,
  changeAdminPassword,
} from "../repositories/passwords.js";
import { newPasswordErrors, RESET_PASSWORD } from "./credentials.js";

export async function resetPassword(db, id) {
  if (!(await findAdminById(db, id)))
    throw new ApiError(404, "NOT_FOUND", "관리자를 찾을 수 없습니다.");
  const salt = randomToken();
  if (
    !(await resetAdminPassword(
      db,
      id,
      await hashPassword(RESET_PASSWORD, salt),
      salt,
      PASSWORD_ITERATIONS,
    ))
  ) {
    throw new ApiError(404, "NOT_FOUND", "관리자를 찾을 수 없습니다.");
  }
  console.info("security: admin_password_reset");
  return { ok: true, must_change_password: true };
}

export async function changePassword(db, userId, input) {
  const allowed = new Set([
    "current_password",
    "password",
    "password_confirmation",
  ]);
  const errors = newPasswordErrors(input.password, input.password_confirmation);
  for (const field of Object.keys(input))
    if (!allowed.has(field))
      errors.push({ field, message: "허용되지 않은 필드입니다." });
  if (
    typeof input.current_password !== "string" ||
    input.current_password.length < 1 ||
    input.current_password.length > 256
  ) {
    errors.push({
      field: "current_password",
      message: "현재 비밀번호를 입력해주세요.",
    });
  } else if (input.current_password === input.password) {
    errors.push({
      field: "password",
      message: "현재 비밀번호와 다른 새 비밀번호를 입력해주세요.",
    });
  }
  if (errors.length)
    throw new ApiError(
      422,
      "VALIDATION",
      "입력한 내용을 확인해주세요.",
      errors,
    );
  const attempt = await reserveLoginAttempt(
    db,
    await sha256(`password-change:${userId}`),
    Math.floor(Date.now() / 1000),
  );
  if (attempt.attempts > 10)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "비밀번호 확인 시도가 많습니다. 15분 후 다시 시도해주세요.",
    );
  const user = await findAdminById(db, userId);
  if (!user?.is_active)
    throw new ApiError(401, "UNAUTHORIZED", "관리자 로그인이 필요합니다.");
  const currentHash = await hashPassword(
    input.current_password,
    user.password_salt,
    user.password_iterations,
  );
  if (!timingSafeEqual(currentHash, user.password_hash)) {
    throw new ApiError(
      403,
      "CURRENT_PASSWORD_INVALID",
      "현재 비밀번호가 올바르지 않습니다.",
    );
  }
  const salt = randomToken();
  if (
    !(await changeAdminPassword(
      db,
      userId,
      user.password_hash,
      await hashPassword(input.password, salt),
      salt,
      PASSWORD_ITERATIONS,
    ))
  ) {
    throw new ApiError(
      409,
      "PASSWORD_CHANGED",
      "비밀번호가 이미 변경되었습니다. 다시 로그인해주세요.",
    );
  }
  console.info("security: admin_password_changed");
  return { ok: true, reauthenticate: true };
}
