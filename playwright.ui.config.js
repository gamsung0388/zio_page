import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  outputDir: ".local/ui-review/test-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    channel: process.env.CI ? "chromium" : "msedge",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev:ui",
    url: "http://127.0.0.1:5175/ui-preview.html",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
