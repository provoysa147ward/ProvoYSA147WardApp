import { expect, test } from "@playwright/test";

import { db, SEEDED_ADMIN, signInAsAdmin } from "./support";

/**
 * The flow the whole site exists for: someone suggests an event, an admin
 * reviews it, and only then does the public see it.
 */

const title = `E2E Pickleball ${Date.now()}`;

test.afterAll(async () => {
  await db().from("events").delete().like("title", "E2E Pickleball%");
});

test("a suggestion stays private until an admin approves it", async ({
  page,
}) => {
  // 1. Anyone can suggest an event, with no account.
  await page.goto("/submit");
  await page.getByLabel("What is it?").fill(title);
  await page.getByLabel("Category").selectOption("sports");
  await page.getByLabel("Date", { exact: false }).first().fill("2026-09-19");
  await page.getByLabel("Start time").fill("19:30");
  await page.getByLabel("End time").fill("21:00");
  await page.getByLabel("Where?").fill("Rock Canyon Park courts");
  await page.getByLabel("Your name").fill("Riley Fields");
  await page.getByLabel("Email or phone").fill("riley@example.com");
  await page.getByRole("button", { name: "Send it in" }).click();

  // 2. The confirmation sets the expectation that it is not live yet.
  await expect(
    page.getByRole("heading", { name: /Thanks — we got it!/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/Approved events appear on the calendar/),
  ).toBeVisible();

  // 3. It is nowhere public.
  await page.goto("/calendar?month=2026-09");
  await expect(page.getByText(title)).toHaveCount(0);

  // 4. An admin sees it in the queue, with the submitter's contact details.
  await signInAsAdmin(page, SEEDED_ADMIN);
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("riley@example.com")).toBeVisible();

  // 5. The admin edits it before approving. Scoped to this queue item — every
  //    item has its own Title field.
  const queueItem = page.locator("details").filter({ hasText: title });
  await queueItem.locator("summary").click();
  const editedTitle = `${title} (edited)`;
  await queueItem.getByLabel("Title").fill(editedTitle);
  await queueItem.getByRole("button", { name: "Save and approve" }).click();
  // It leaves the queue; the seeded suggestions are still there.
  await expect(page.getByText(title, { exact: false })).toHaveCount(0);

  // 6. The edited version — not the original — is what the public gets.
  await page.goto("/calendar?month=2026-09");
  await expect(page.getByText(editedTitle).first()).toBeVisible();

  // 7. And the submitter's details never reached the public page.
  expect(await page.content()).not.toContain("riley@example.com");
});

test("a rejected suggestion disappears from every public surface", async ({
  page,
}) => {
  const rejectedTitle = `E2E Pickleball Reject ${Date.now()}`;

  await db()
    .from("events")
    .insert({
      status: "pending",
      title: rejectedTitle,
      category: "other",
      event_date: "2026-09-20",
      start_time: "18:00:00",
      location: "Somewhere",
      submitter_name: "Someone",
      submitter_contact: "someone@example.com",
    });

  await signInAsAdmin(page, SEEDED_ADMIN);
  const queueItem = page.locator("details").filter({ hasText: rejectedTitle });
  await queueItem.locator("summary").click();
  await queueItem.getByRole("button", { name: "Reject" }).click();

  await page.goto("/calendar?month=2026-09");
  await expect(page.getByText(rejectedTitle)).toHaveCount(0);

  await page.goto("/");
  await expect(page.getByText(rejectedTitle)).toHaveCount(0);

  // Rejected, not deleted: the record survives for the admins.
  const { data } = await db()
    .from("events")
    .select("status")
    .eq("title", rejectedTitle)
    .single();
  expect(data?.status).toBe("rejected");
});

test("the honeypot silently discards a bot submission", async ({ page }) => {
  const botTitle = `E2E Pickleball Bot ${Date.now()}`;

  await page.goto("/submit");
  await page.getByLabel("What is it?").fill(botTitle);
  await page.getByLabel("Category").selectOption("other");
  await page.getByLabel("Date", { exact: false }).first().fill("2026-09-21");
  await page.getByLabel("Start time").fill("12:00");
  await page.getByLabel("Where?").fill("Nowhere");
  await page.getByLabel("Your name").fill("Bot");
  await page.getByLabel("Email or phone").fill("bot@spam.example");

  // Only a bot fills this in — it is display:none and aria-hidden.
  await page
    .locator('input[name="website"]')
    .evaluate((input: HTMLInputElement) => {
      input.value = "http://buy-things.example";
    });

  await page.getByRole("button", { name: "Send it in" }).click();

  // It sees the same confirmation a person would, and no row is created.
  await expect(
    page.getByRole("heading", { name: /Thanks — we got it!/ }),
  ).toBeVisible();

  const { data } = await db()
    .from("events")
    .select("id")
    .eq("title", botTitle);
  expect(data).toEqual([]);
});
