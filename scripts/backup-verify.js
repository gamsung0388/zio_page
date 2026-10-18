import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { readConfig } from "./deploy-config.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length !== 1 || !["--remote", "--local"].includes(args[0]))
  throw new Error(
    "대상을 명시해주세요: npm run backup:verify -- --remote 또는 --local",
  );
const remote = args[0] === "--remote";
const db = readConfig().d1_databases.find(
  (database) => database.binding === "DB",
);
if (!db?.database_name) throw new Error("DB 바인딩을 확인해주세요.");
const time = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})
  .format(new Date())
  .replace(/[^0-9]/g, "");
const directory = join(
  root,
  ".local",
  "backups",
  `verified-${time}-${randomUUID().slice(0, 8)}`,
);
const state = join(directory, "restore-state"),
  sqlFile = join(directory, "database.sql"),
  log = join(directory, "verification-private.log");
if (
  !resolve(state)
    .toLowerCase()
    .startsWith((resolve(root, ".local", "backups") + sep).toLowerCase())
)
  throw new Error("검증 경로가 백업 폴더 밖입니다.");
await mkdir(dirname(directory), { recursive: true });
await mkdir(directory);
const cli = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const configArgs = ["--config", join(root, "wrangler.jsonc")];
const sourceArgs = [remote ? "--remote" : "--local", ...configArgs];
const restoreArgs = ["--local", "--persist-to", state, ...configArgs];

async function run(command, flags) {
  try {
    const output = execFileSync(
      process.execPath,
      [cli, "d1", command, db.database_name, ...flags],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 120000,
        windowsHide: true,
        env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" },
      },
    );
    await appendFile(log, output + "\n");
    return output;
  } catch (error) {
    await appendFile(
      log,
      String(error.stdout || "") + String(error.stderr || ""),
    );
    throw new Error(
      `백업 파일은 보존됩니다. 도구 실행 기록을 확인해주세요: ${log}`,
    );
  }
}
async function query(target, sql) {
  const output = await run("execute", [...target, "--command", sql, "--json"]);
  const responses = JSON.parse(output.replace(/^\uFEFF/, ""));
  if (
    !Array.isArray(responses) ||
    responses.some((response) => response.success === false || response.error)
  )
    throw new Error("DB 검증 조회에 실패했습니다.");
  return responses.map((response) => response.results || []);
}
async function snapshot(target) {
  const [objects] = await query(
    target,
    "SELECT type,name,tbl_name FROM sqlite_master WHERE type IN ('table','index','view','trigger') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type,name",
  );
  const tables = objects
    .filter((object) => object.type === "table")
    .map((object) => object.name);
  if (
    !tables.length ||
    tables.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
  )
    throw new Error("백업 대상 테이블을 확인할 수 없습니다.");
  // D1 limits compound SELECT terms; keep each read batch small.
  const counts = [];
  for (let offset = 0; offset < tables.length; offset += 5) {
    const sql = tables
      .slice(offset, offset + 5)
      .map(
        (name) =>
          `SELECT '${name}' AS table_name, COUNT(*) AS total FROM "${name}"`,
      )
      .join(" UNION ALL ");
    const [rows] = await query(target, sql);
    counts.push(...rows);
  }
  return { objects, counts };
}

console.log("D1 SQL 백업과 별도 로컬 복구 검증을 시작합니다.");
const before = await snapshot(sourceArgs);
await run("export", [
  ...sourceArgs,
  "--output",
  sqlFile,
  "--skip-confirmation",
]);
const after = await snapshot(sourceArgs);
const sqlBytes = await readFile(sqlFile);
if (!sqlBytes.length) throw new Error("SQL 백업이 비어 있습니다.");
// The restore target is a new, private local directory. Never restore into remote/dev state.
await run("execute", [...restoreArgs, "--file", sqlFile, "--yes"]);
const restored = await snapshot(restoreArgs);
const [integrity] = await query(restoreArgs, "PRAGMA quick_check");
const [foreignKeys] = await query(restoreArgs, "PRAGMA foreign_key_check");
const stable = JSON.stringify(before) === JSON.stringify(after);
const matches = JSON.stringify(restored) === JSON.stringify(after);
const healthy =
  integrity.length === 1 &&
  Object.values(integrity[0]).includes("ok") &&
  foreignKeys.length === 0;
const report = {
  checkedAt: new Date().toISOString(),
  source: remote ? "remote" : "local",
  databaseName: db.database_name,
  sqlFile,
  restoreState: state,
  backupBytes: sqlBytes.length,
  backupSha256: createHash("sha256").update(sqlBytes).digest("hex"),
  sourceStableDuringExport: stable,
  restoredSchemaAndCountsMatch: matches,
  integrityCheck: integrity,
  foreignKeyIssues: foreignKeys.length,
  counts: restored.counts,
  operatingDataWrites: 0,
  success: stable && matches && healthy,
};
await writeFile(
  join(directory, "verification.json"),
  JSON.stringify(report, null, 2),
);
if (!report.success)
  throw new Error(
    `복구 검증을 통과하지 못했습니다. 백업을 보존했습니다: ${directory}`,
  );
console.log(`백업 및 복구 검증 완료: ${directory}`);
console.log(
  `확인한 테이블 ${restored.counts.length}개 · 무결성 정상 · 운영 데이터 변경 0건`,
);
