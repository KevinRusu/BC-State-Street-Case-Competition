import { defineConfig, devices } from "@playwright/test";

const baseURL = `http://127.0.0.1:${process.env.DASHBOARD_TEST_PORT || "3100"}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  outputDir: "../tests/runs/dashboard_browser/artifacts",
  reporter: [["list"], ["html", { outputFolder: "../tests/runs/dashboard_browser/report", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"], viewport: { width: 1550, height: 1100 }, baseURL,
    trace: "retain-on-failure", screenshot: "only-on-failure",
    launchOptions: process.env.DASHBOARD_TEST_BROWSER ? { executablePath: process.env.DASHBOARD_TEST_BROWSER } : {},
  },
  webServer: {
    command: "node scripts/test-server.mjs",
    url: baseURL,
    timeout: 240_000,
    reuseExistingServer: false,
  },
});
