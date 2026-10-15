import { ApiError } from "../utils/http.js";
import {
  hashPassword,
  PASSWORD_ITERATIONS,
  randomToken,
} from "../utils/crypto.js";
import { insertAdmin } from "../repositories/admin-users.js";
import { newPasswordErrors } from "./credentials.js";

const fields = new Set([
  "username",
  "display_name",
  "password",
  "password_confirmation",
]);
export async function registerAdmin(db, input) {
  const errors = [];
  for (const field of Object.keys(input)) {
    if (!fields.has(field))
      errors.push({ field, message: "허용되지 않은 필드입니다." });
  }
  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(username)) {
    errors.push({
      field: "username",
      message: "아이디는 영문·숫자·점·밑줄·하이픈으로 3~80자를 입력해주세요.",
    });
  }
  let displayName = input.display_name ?? "";
  if (typeof displayName !== "string" || displayName.trim().length > 80) {
    errors.push({
      field: "display_name",
      message: "표시 이름은 80자 이하로 입력해주세요.",
    });
  } else displayName = displayName.trim() || username;
  errors.push(
    ...newPasswordErrors(input.password, input.password_confirmation),
  );
  if (errors.length)
    throw new ApiError(
      422,
      "VALIDATION",
      "입력한 내용을 확인해주세요.",
      errors,
    );

  const salt = randomToken();
  const account = await insertAdmin(db, {
    username,
    display_name: displayName,
    password_hash: await hashPassword(input.password, salt),
    password_salt: salt,
    password_iterations: PASSWORD_ITERATIONS,
  });
  if (!account)
    throw new ApiError(
      409,
      "USERNAME_EXISTS",
      "이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.",
    );
  console.info("security: admin_created");
  return account;
}
