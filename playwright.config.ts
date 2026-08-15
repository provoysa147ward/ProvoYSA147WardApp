import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

import { wardToday } from "./lib/date";
import { buildCalendarFixture } from "./tests/e2e/fixtures/calendarEvents";

/**
 * End-to-end tests against the local Supabase stack.
 *
 * Requires `supabase start` and a seeded database (`supabase db reset`). The
 * suite drives a real browser through the flows that matter most and that unit
 * tests cannot prove: the calendar over real event data, a non-admin being
 * refused, and the admin turnover drill.
 *
 * `baseURL` is port 3000 because Supabase's `site_url` points there — the magic
 * links in the local mail catcher are absolute.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * Events come from Google in production, so the suite hands the app a fixture
 * calendar instead of credentials. Generated here rather than checked in
 * because it is dated relative to today: the site only shows events from today
 * forward, so fixed dates would stop covering anything the day they passed.
 *
 * The app resolves `CALENDAR_FIXTURES` inside `tests/e2e/fixtures`, so this is
 * a bare file name.
 */
const FIXTURE_NAME = "calendar-events.json";

function writeCalendarFixture(): string {
  const directory = path.join(__dirname, "tests", "e2e", "fixtures");
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, FIXTURE_NAME),
    JSON.stringify(buildCalendarFixture(wardToday()), null, 2),
  );
  return FIXTURE_NAME;
}

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
      CALENDAR_FIXTURES: writeCalendarFixture(),
    },
  },
});
