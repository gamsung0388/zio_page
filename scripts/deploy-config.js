import { readFileSync } from "node:fs";
import { parse } from "jsonc-parser";

export function readConfig() {
  const errors = [];
  const config = parse(
    readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    errors,
    { allowTrailingComma: true },
  );
  if (errors.length || !config)
    throw new Error("wrangler.jsonc 파일 형식을 확인해주세요.");
  return config;
}
export function deploymentErrors(config) {
  const errors = [];
  if (config.vars?.APP_ENV !== "production")
    errors.push("APP_ENV는 production이어야 합니다.");
  const id = config.d1_databases?.find(
    (db) => db.binding === "DB",
  )?.database_id;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id || "",
    )
  ) {
    errors.push(
      "Cloudflare에서 발급한 실제 database_id를 DB 바인딩에 추가해주세요.",
    );
  }
  const primary = config.d1_databases?.find((db) => db.binding === "DB");
  if (
    primary?.database_name &&
    config.d1_databases.some(
      (db) => db !== primary && db.database_name === primary.database_name,
    )
  ) {
    errors.push(
      "같은 데이터베이스가 중복 연결되어 있습니다. 해당 DB 설정을 binding=DB 하나로 합쳐주세요.",
    );
  }
  return errors;
}
