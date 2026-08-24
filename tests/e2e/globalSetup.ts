import { FIXTURE_TITLES } from "./fixtures/calendarEvents";

/**
 * Proves the server the suite is about to drive is the one Playwright's
 * `webServer` block configured.
 *
 * `reuseExistingServer` is on outside CI, which is what makes iterating on the
 * specs quick — but it means a `npm run dev` server already sitting on the
 * port gets adopted silently. That server has no `CALENDAR_FIXTURES` in its
 * environment, so the app falls back to the real Google Calendar and every
 * calendar assertion fails on a missing fixture event. The failures point at
 * the specs, and the cause is two directories away.
 *
 * So: fetch the home page and look for a fixture event. If it is not there,
 * fail with the fix rather than letting six specs fail with the symptom.
 */
export default async function globalSetup() {
  const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";

  const response = await fetch(baseUrl);
  const html = await response.text();

  // The window "Coming up" shows is a week, and the fixture puts Volleyball on
  // tomorrow, so it is on the home page whatever day the suite runs.
  if (html.includes(FIXTURE_TITLES.sports)) return;

  throw new Error(
    `The server on ${baseUrl} is not serving the calendar fixture, so the ` +
      `calendar specs cannot pass.\n\n` +
      `The usual cause is a "npm run dev" server already on that port: ` +
      `Playwright reuses it, and it has no CALENDAR_FIXTURES in its ` +
      `environment. Stop it and re-run — the suite starts its own server.`,
  );
}
