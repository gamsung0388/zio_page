import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { deploymentErrors, readConfig } from "../scripts/deploy-config.js";

test("Wrangler JSONC with comments/trailing commas parses and checks production bindings", () => {
  const config = readConfig();
  assert.equal(config.name, "zio-home");
  assert.equal(config.vars.APP_ENV, "production");
  assert.ok(config.assets.run_worker_first.includes("/api/*"));
  assert.equal(
    deploymentErrors({
      vars: { APP_ENV: "production" },
      d1_databases: [{ binding: "DB", database_id: randomUUID() }],
    }).length,
    0,
  );
  assert.equal(
    deploymentErrors({ vars: { APP_ENV: "development" }, d1_databases: [] })
      .length,
    2,
  );
});
test("deployment guard validates missing IDs even after the real DB is configured", () => {
  const missing = {
    vars: { APP_ENV: "production" },
    d1_databases: [{ binding: "DB" }],
  };
  assert.match(deploymentErrors(missing).join(" "), /실제 database_id/);
  if (
    readConfig().d1_databases.find((db) => db.binding === "DB")?.database_id
  ) {
    assert.doesNotThrow(() =>
      execFileSync(process.execPath, ["scripts/check-deploy.js"], {
        stdio: "pipe",
      }),
    );
  }
});
test("duplicate automatic D1 bindings produce a clear corrective error", () => {
  const duplicate = {
    vars: { APP_ENV: "production" },
    d1_databases: [
      { binding: "DB", database_name: "zio-home-db" },
      {
        binding: "zio_home_db",
        database_name: "zio-home-db",
        database_id: randomUUID(),
      },
    ],
  };
  assert.match(deploymentErrors(duplicate).join(" "), /중복 연결/);
  const configured = readConfig().d1_databases.filter(
    (db) => db.database_name === "zio-home-db",
  );
  assert.equal(configured.length, 1);
  assert.equal(configured[0].binding, "DB");
  assert.notEqual(configured[0].remote, true);
});
