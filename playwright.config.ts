import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the local Supabase stack.
 *
 * Requires `supabase start` and a seeded database (`supabase db reset`). The
 * suite drives a real browser through the flows that matter most and that unit
 * tests cannot prove: a suggestion becoming public, a non-admin being refused,
 * and the admin turnover drill.
 *
 * `baseURL` is port 3000 because Supabase's `site_url` points there — the magic
 * links in the local mail catcher are absolute.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run build && npm run start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      // The keepalive route refuses to run without this.
      CRON_SECRET: process.env.CRON_SECRET ?? "e2e-cron-secret",
    },
  },
});
