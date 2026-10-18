import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.ZIO_E2E_PASSWORD ||= randomBytes(32).toString("hex");
process.env.ZIO_E2E_USERNAME ||= "qa-" + randomBytes(6).toString("hex");
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: process.env.CI ? "chromium" : "msedge",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "node tests/e2e/prepare.js && npm run dev -- --mode e2e --port 5174",
    url: "http://127.0.0.1:5174/api/health?db=1",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
