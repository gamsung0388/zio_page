import { RESET_PASSWORD } from "./credentials.js";
import { ApiError } from "../utils/http.js";
import {
  hashPassword,
  PASSWORD_ITERATIONS,
  randomToken,
  sha256,
  timingSafeEqual,
} from "../utils/crypto.js";
import {
  findUser,
  reserveLoginAttempt,
  releaseLoginAttempts,
  createSession,
} from "../repositories/auth.js";

export async function login(db, credentials, ip) {
  const { username, password } = credentials;
  if (
    typeof username !== "string" ||
    username.length < 1 ||
    username.length > 80 ||
    typeof password !== "string" ||
    password.length > 256 ||
    password.length < 1
  ) {
    throw new ApiError(400, "CREDENTIALS", "아이디와 비밀번호를 입력해주세요.");
  }
  const now = Math.floor(Date.now() / 1000);
  // Reserve before verification so concurrent requests cannot bypass the counter.
  const ipKey = await sha256(`ip:${ip}`),
    accountKey = await sha256(`user:${username}`);
  const ipAttempt = await reserveLoginAttempt(db, ipKey, now);
  if (ipAttempt.attempts > 10)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "로그인 시도가 많습니다. 15분 후 다시 시도해주세요.",
    );
  const accountAttempt = await reserveLoginAttempt(db, accountKey, now);
  if (accountAttempt.attempts > 20)
    throw new ApiError(
      429,
      "RATE_LIMIT",
      "로그인 시도가 많습니다. 15분 후 다시 시도해주세요.",
    );
  const user = await findUser(db, username);
  // Run the same expensive KDF for unknown usernames.
  const digest = await hashPassword(
    password,
    user?.password_salt || "zio-missing-account-dummy-salt",
    user?.password_iterations || PASSWORD_ITERATIONS,
  );
  if (!user || !timingSafeEqual(digest, user.password_hash)) {
    console.info("security: login_failed");
    throw new ApiError(
      401,
      "LOGIN_FAILED",
      "아이디 또는 비밀번호가 올바르지 않습니다.",
    );
  }
  if (password === RESET_PASSWORD && !user.must_change_password) {
    await db
      .prepare("UPDATE admin_users SET must_change_password=1 WHERE id=?")
      .bind(user.id)
      .run();
    user.must_change_password = 1;
  }
  await releaseLoginAttempts(db, [
    { key: ipKey, expires_at: ipAttempt.expires_at },
    { key: accountKey, expires_at: accountAttempt.expires_at },
  ]);
  const token = randomToken();
  await createSession(
    db,
    user.id,
    await sha256(token),
    new Date(Date.now() + 7 * 86400000).toISOString(),
  );
  console.info("security: login_succeeded");
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      must_change_password: Boolean(user.must_change_password),
    },
    csrfToken: await sha256(`csrf:${token}`),
  };
}
