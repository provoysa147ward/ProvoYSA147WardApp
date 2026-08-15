import { expect, test } from "@playwright/test";

import {
  FIXTURE_PRIVATE_DETAILS,
  FIXTURE_TITLES,
} from "./fixtures/calendarEvents";

/**
 * The public surfaces, at both widths, against the seeded database and the
 * fixture calendar that stands in for the ward's Google Calendar (see
 * `playwright.config.ts`).
 */

test("the home page shows the announcement and upcoming events", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Provo YSA 147th Ward", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(/Ward temple night/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "See the calendar" }),
  ).toBeVisible();

  // Straight from the calendar fixture, chip and all.
  await expect(page.getByText(FIXTURE_TITLES.sports)).toBeVisible();
  await expect(page.getByText(FIXTURE_TITLES.allDay)).toBeVisible();

  // "Coming up" is the next week only — the fixture's day+9 event is on the
  // calendar page, not here.
  await expect(page.getByText(FIXTURE_TITLES.beyondWeek)).toHaveCount(0);
});

test("the home page leads with the GroupMe banner and the survey link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("link", { name: /Join the Ward GroupMe/ }),
  ).toHaveAttribute("href", /groupme\.com\/join_group\//);

  await page.getByRole("link", { name: "New Member Survey" }).click();
  await expect(
    page.getByRole("heading", { name: "New Member Survey", level: 1 }),
  ).toBeVisible();
});

test("the retired /submit route redirects to the home page", async ({
  page,
}) => {
  await page.goto("/submit");

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { name: "Provo YSA 147th Ward", level: 1 }),
  ).toBeVisible();
});

test("the calendar opens in the device's default view, without console errors", async ({
  page,
}) => {
  // A hydration mismatch is a console error, so an empty console is the
  // machine-checkable version of "the view resolution does not flicker".
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/calendar");
  await expect(
    page.getByRole("button", { name: "Month", pressed: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/calendar");
  await expect(
    page.getByRole("button", { name: "Schedule", pressed: true }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  expect(problems).toEqual([]);
});

test("the calendar remembers the view you picked", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/calendar");

  await page
    .getByRole("group", { name: "Calendar view" })
    .getByRole("button", { name: "Week", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Week", pressed: true }),
  ).toBeVisible();

  await page.goto("/calendar");
  await expect(
    page.getByRole("button", { name: "Week", pressed: true }),
  ).toBeVisible();

  // An explicit ?month= link still wins over the remembered choice.
  await page.goto("/calendar?month=2026-09");
  await expect(
    page.getByRole("button", { name: "Month", pressed: true }),
  ).toBeVisible();
});

test("tapping an event opens its details, with nobody's contact on it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/calendar");

  await page
    .getByRole("button", { name: new RegExp(FIXTURE_TITLES.social) })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: FIXTURE_TITLES.social }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /Add to Google Calendar/ }),
  ).toBeVisible();
  await expect(dialog.getByText("@example.com")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("every view renders the calendar, all-day events included", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/calendar");

  // Scoped to the switcher: "Day" and "Week" also appear inside event titles
  // ("All day") and in the week navigation ("Next week").
  const views = page.getByRole("group", { name: "Calendar view" });

  await views.getByRole("button", { name: "Schedule", exact: true }).click();
  // A multi-day all-day event shows on each day it covers, labelled as such.
  await expect(
    page.getByRole("button", { name: new RegExp(FIXTURE_TITLES.multiDay) }),
  ).toHaveCount(3);
  await expect(page.getByText("All day").first()).toBeVisible();
  // Past-midnight events keep their "(next day)" note.
  await expect(page.getByText(/\(next day\)/)).toBeVisible();

  // Which events land in "this week" depends on the day the suite runs, so the
  // week view is checked by its own navigation rather than by its contents.
  await views.getByRole("button", { name: "Week", exact: true }).click();
  const weekLabel = page.getByRole("heading", { level: 2 });
  const thisWeek = await weekLabel.textContent();
  expect(thisWeek).toMatch(/\d{4}$/);

  await page.getByRole("button", { name: "Next week" }).click();
  await expect(weekLabel).not.toHaveText(thisWeek!);

  await views.getByRole("button", { name: "Day", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next day" })).toBeVisible();

  await views.getByRole("button", { name: "Month", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();

  // A cancelled instance never appears in any of them.
  expect(await page.content()).not.toContain(FIXTURE_TITLES.cancelled);
});

test("the groups page hides the Join button when there is no link", async ({
  page,
}) => {
  await page.goto("/groups");

  await expect(page.getByRole("heading", { name: "Volleyball" })).toBeVisible();

  // The seeded Service group deliberately has no GroupMe link.
  const service = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Service" }) });
  await expect(
    service.getByRole("link", { name: /Join on GroupMe/ }),
  ).toHaveCount(0);
});

test("no public page leaks who organised an event or who is coming", async ({
  page,
}) => {
  for (const path of ["/", "/calendar", "/calendar?month=2026-09", "/groups"]) {
    await page.goto(path);
    const html = await page.content();
    for (const detail of FIXTURE_PRIVATE_DETAILS) {
      expect(html).not.toContain(detail);
    }
    expect(html).not.toContain(FIXTURE_TITLES.cancelled);
  }
});

test("the month grid fits a 375px viewport", async ({ page }) => {
  // Before the switcher the grid was fenced off below md, so a phone could
  // never render it. Now the Month button (or a ?month= link) can.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/calendar");
  await page
    .getByRole("group", { name: "Calendar view" })
    .getByRole("button", { name: "Month", exact: true })
    .click();

  await expect(page.getByRole("table")).toBeVisible();

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});

test("the home page fits a 375px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  // Nothing may overflow horizontally on a phone.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflows).toBe(false);
});
