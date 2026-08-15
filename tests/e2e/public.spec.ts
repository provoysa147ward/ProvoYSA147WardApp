import { expect, test } from "@playwright/test";

/** The public surfaces, at both widths, against the seeded database. */

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
});

test("the home page leads with the GroupMe banner and the survey link", async ({
  page,
}) => {
  await page.goto("/");

  const banner = page.getByRole("region", { name: "Join the ward GroupMe" });
  await expect(banner).toBeVisible();
  await expect(
    banner.getByRole("link", { name: /Join the Ward GroupMe/ }),
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

  await page.getByRole("button", { name: "Week" }).click();
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

test("tapping an event opens its details without any submitter contact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/calendar");

  await page
    .getByRole("button", { name: /Break the Fast/ })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Break the Fast" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: /Add to Google Calendar/ }),
  ).toBeVisible();
  await expect(dialog.getByText("@example.com")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
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

test("no public page leaks a pending or rejected event", async ({ page }) => {
  for (const path of ["/", "/calendar", "/groups"]) {
    await page.goto(path);
    const html = await page.content();
    expect(html).not.toContain("Ultimate Frisbee");
    expect(html).not.toContain("Off-Campus Party");
  }
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
