import { defineConfig, devices } from "@playwright/test";

// Ticket 30: the five E2E flows run against a production build served from a
// FRESH database — globalSetup wipes + migrates e2e-test.db before the
// server boots, and the server gets the same file via webServer.env (never
// the dev local.db, never Turso remote). The `setup` project signs the
// shared user up once and freezes its cookies; every flow reuses that
// storageState (auth.spec opts out — it proves the logged-out experience).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    timezoneId: "Asia/Tehran",
  },
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    // Never reuse: a dev server on :3000 serves the WRONG database
    // (local.db instead of the fresh e2e-test.db) — a clash must fail
    // loudly, not silently test the wrong server.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      TURSO_DATABASE_URL: "file:./e2e-test.db",
      // CI-only dev value, not a real credential (mirrors .github/workflows/ci.yml)
      BETTER_AUTH_SECRET: "e2e-only-dev-secret-not-a-real-credential",
    },
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
