import { readConfig } from "../../scripts/deploy-config.js";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import {
  hashPassword,
  PASSWORD_ITERATIONS,
  randomToken,
} from "../../server/utils/crypto.js";
if (readConfig().d1_databases?.some((db) => db.remote === true))
  throw new Error(
    "E2E는 원격 DB 연결을 허용하지 않습니다. wrangler.jsonc에서 remote: false를 설정해주세요.",
  );
const username = process.env.ZIO_E2E_USERNAME,
  password = process.env.ZIO_E2E_PASSWORD;
if (!username?.startsWith("qa-") || !password)
  throw new Error("Run via npm run test:e2e.");
const wranglerArgs = ["node_modules/wrangler/bin/wrangler.js", "d1"];
const targetArgs = [
  "zio-home-db",
  "--local",
  "--persist-to",
  ".local/e2e/state",
  "--config",
  "wrangler.jsonc",
];
execFileSync(
  process.execPath,
  [...wranglerArgs, "migrations", "apply", ...targetArgs],
  { stdio: "pipe" },
);
const salt = randomToken();
const hash = await hashPassword(password, salt);
const directory = resolve(".local/e2e");
mkdirSync(directory, { recursive: true });
const file = resolve(directory, "setup.sql");
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
try {
  // This path is only used by Vite mode=e2e; ordinary local DB is never touched.
  writeFileSync(
    file,
    `DELETE FROM admin_schedule_events; DELETE FROM admin_schedule_weeks; DELETE FROM songs; DELETE FROM admin_sessions; DELETE FROM admin_users; DELETE FROM login_limits;
    INSERT INTO admin_users(username, display_name, password_hash, password_salt, password_iterations)
    VALUES (${quote(username)}, 'QA 전용', ${quote(hash)}, ${quote(salt)}, ${PASSWORD_ITERATIONS});`,
  );
  execFileSync(
    process.execPath,
    [...wranglerArgs, "execute", ...targetArgs, "--file", file],
    { stdio: "pipe" },
  );
} finally {
  unlinkSync(file);
}
