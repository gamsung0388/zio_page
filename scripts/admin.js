import { promptNewPassword } from "./password-prompt.js";
import { createInterface } from "node:readline/promises";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  hashPassword,
  PASSWORD_ITERATIONS,
  randomToken,
} from "../server/utils/crypto.js";

const operation = process.argv[2];
const remote = process.argv.includes("--remote");
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
async function main() {
  if (!["create", "revoke"].includes(operation) || !process.stdin.isTTY)
    throw new Error(
      "터미널에서 npm run admin:create 또는 npm run admin:revoke를 실행해주세요. 비밀번호는 화면에 표시되지 않습니다.",
    );
  console.log(
    `${remote ? "원격 D1" : "로컬 D1"} 관리자 ${operation === "create" ? "생성" : "전체 세션 폐기"}`,
  );
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const username = (
    await rl.question("관리자 아이디 (3~80자, 영문/숫자/._-): ")
  ).trim();
  const displayName =
    operation === "create"
      ? (await rl.question("표시 이름 (비우면 아이디 사용): ")).trim() ||
        username
      : "";
  rl.close();
  if (!/^[A-Za-z0-9_.-]{3,80}$/.test(username) || displayName.length > 80)
    throw new Error("아이디 또는 표시 이름을 확인해주세요.");
  let sql;
  if (operation === "create") {
    const password = await promptNewPassword();
    const salt = randomToken();
    const digest = await hashPassword(password, salt);
    sql = `INSERT INTO admin_users(username, display_name, password_hash, password_salt, password_iterations) VALUES (${[username, displayName, digest, salt].map(quote).join(",")}, ${PASSWORD_ITERATIONS});`;
  } else
    sql = `DELETE FROM admin_sessions WHERE admin_user_id IN (SELECT id FROM admin_users WHERE username=${quote(username)});`;
  const directory = resolve(".local");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, `admin-${randomUUID()}.sql`);
  try {
    writeFileSync(path, sql, { mode: 0o600 });
    execFileSync(
      process.execPath,
      [
        "node_modules/wrangler/bin/wrangler.js",
        "d1",
        "execute",
        "zio-home-db",
        remote ? "--remote" : "--local",
        "--file",
        path,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    console.log(
      operation === "create"
        ? "관리자 계정을 생성했습니다. /admin/login에서 로그인하세요."
        : "해당 관리자의 모든 세션을 폐기했습니다.",
    );
  } catch {
    throw new Error(
      "D1 작업에 실패했습니다. 마이그레이션, 계정 중복, 원격 인증 상태를 확인해주세요.",
    );
  } finally {
    unlinkSync(path);
  }
}
main().catch((error) => {
  console.error(
    ["ExitPromptError", "AbortPromptError"].includes(error.name)
      ? "관리자 설정을 취소했습니다."
      : error.message,
  );
  process.exitCode = 1;
});
