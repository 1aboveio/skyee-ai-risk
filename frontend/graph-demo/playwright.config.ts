import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // sequential for deterministic DB state
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command:
      "DATABASE_URL=postgres://graph_demo:graph_demo@localhost:5432/graph_demo APP_SESSION_SECRET=test-session-secret-for-e2e-only-32b! pnpm dev",
    url: "http://localhost:3000/api/health",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    cwd: ".",
  },
});
