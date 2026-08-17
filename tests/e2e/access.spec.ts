import { expect, test } from "@playwright/test";

import {
  SEEDED_ADMIN,
  SEEDED_PERMANENT_ADMIN,
  clearMailbox,
  db,
  deleteAuthUser,
  signInAsAdmin,
  waitForSignInLink,
} from "./support";

/**
 * Who can get into the admin area, and the turnover drill that has to work
 * without a developer for the site to survive its own handover.
 */

const NEW_ADMIN = "e2e-newadmin@example.com";
const OUTSIDER = "e2e-outsider@example.com";
const NEW_GROUP = "E2E Pickleball";

test.afterEach(async () => {
  await db().from("admin_emails").delete().eq("email", NEW_ADMIN);
  await db().from("admin_emails").delete().eq("email", OUTSIDER);
  // The spec deletes this itself; this is the safety net for a run that failed
  // partway through and left the row behind.
  await db().from("groups").delete().eq("name", NEW_GROUP);
  await deleteAuthUser(NEW_ADMIN);
  await deleteAuthUser(OUTSIDER);
  // Put the seeded admin back if a spec removed them.
  await db()
    .from("admin_emails")
    .upsert({ email: SEEDED_ADMIN }, { onConflict: "email" });
});

test("a signed-out visitor is sent to sign in", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(page.url()).toContain("/admin/login");
  expect(response?.status()).toBeLessThan(400);
});

test("an admin removed mid-session gets 403 and a way to sign out", async ({
  page,
}) => {
  // Reaching a signed-in non-admin state the way it actually happens: someone
  // signs in legitimately, then another admin removes them. Same code path as
  // any signed-in non-admin, and it exercises the removal case too.
  await db()
    .from("admin_emails")
    .upsert({ email: OUTSIDER }, { onConflict: "email" });
  await signInAsAdmin(page, OUTSIDER);

  await db().from("admin_emails").delete().eq("email", OUTSIDER);

  // The groups page is the other thing they had access to a moment ago. It
  // stays reachable — it is public — but it drops back to the plain view.
  await page.goto("/groups");
  await expect(page.getByRole("heading", { name: "Volleyball" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add group" })).toHaveCount(0);

  const response = await page.goto("/admin");
  expect(response?.status()).toBe(403);
  await expect(
    page.getByRole("heading", { name: /don't have admin access/ }),
  ).toBeVisible();

  // Signing out is offered right there, and lands on an explanatory page.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/error=removed/);
  await expect(page.getByText(/admin access was removed/)).toBeVisible();
});

test("an expired or reused sign-in link gets a friendly resend page", async ({
  page,
}) => {
  await clearMailbox();
  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(SEEDED_ADMIN);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByText("Check your email").waitFor();

  const link = await waitForSignInLink(SEEDED_ADMIN);

  await page.goto(link);
  await expect(page.getByRole("button", { name: "Add group" })).toBeVisible();

  // The same link a second time is no good.
  await page.goto(link);
  await expect(
    page.getByText(/already been used or has expired/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeVisible();
});

test("an admin lands on the groups page, ready to edit it", async ({ page }) => {
  await signInAsAdmin(page, SEEDED_ADMIN);

  await expect(page).toHaveURL(/\/groups$/);
  await expect(page.getByRole("button", { name: "Add group" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Volleyball" }),
  ).toBeVisible();

  // The dashboard is still there, one click away, and still points at Google.
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: /Events live in the ward Google Calendar/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Open Google Calendar/ }),
  ).toBeVisible();

  // The retired screens are gone from the admin nav — events to Google
  // Calendar, groups to the public page they are edited on.
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Events" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Queue" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Groups" })).toHaveCount(0);
});

test("the groups page offers a visitor no way to change anything", async ({
  page,
}) => {
  await page.goto("/groups");

  await expect(page.getByRole("heading", { name: "Volleyball" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add group" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("the footer offers a way in, and it leads to sign-in", async ({ page }) => {
  await page.goto("/");

  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Admin" })
    .click();

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" }),
  ).toBeVisible();
});

test("an admin adds and edits a group without leaving the page", async ({
  page,
}) => {
  await signInAsAdmin(page, SEEDED_ADMIN);

  // Add it.
  await page.getByRole("button", { name: "Add group" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Name/).fill(NEW_GROUP);
  await dialog.getByLabel(/^Description/).fill("Created by the e2e suite.");
  await dialog.getByLabel(/^When and where/).fill("Thursdays, whenever");
  await dialog.getByRole("button", { name: "Add group" }).click();

  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: NEW_GROUP }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("Thursdays, whenever")).toBeVisible();

  // Edit it, in place, from the card itself.
  await card.getByRole("button", { name: `Edit ${NEW_GROUP}` }).click();
  await dialog.getByLabel(/^When and where/).fill("Fridays instead");
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(card.getByText("Fridays instead")).toBeVisible();
  await expect(dialog).toBeHidden();

  // Delete it, which is also the cleanup.
  await card.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete it" }).click();

  await expect(
    page.getByRole("heading", { name: NEW_GROUP }),
  ).toHaveCount(0);
});

test("a non-allowlisted address gets the same reply and no email", async ({
  page,
}) => {
  await clearMailbox();

  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(OUTSIDER);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();

  // Identical wording to the allowlisted case — no enumeration.
  await expect(page.getByText("Check your email")).toBeVisible();

  await expect(async () => {
    const response = await fetch(
      "http://127.0.0.1:54324/api/v1/messages?limit=10",
    );
    const inbox = (await response.json()) as { total: number };
    expect(inbox.total).toBe(0);
  }).toPass({ timeout: 5_000 });
});

test("the turnover drill: add a replacement, then remove yourself", async ({
  page,
}) => {
  await signInAsAdmin(page, SEEDED_ADMIN);

  // 1. The outgoing admin adds their replacement.
  await page.goto("/admin/admins");
  await page.getByLabel("Email address").fill(NEW_ADMIN);
  await page.getByRole("button", { name: "Add admin" }).click();
  await expect(page.getByText(`${NEW_ADMIN} can now sign in`)).toBeVisible();

  // 2. The ward's permanent row offers no way to remove it.
  const permanentRow = page.locator("li", {
    hasText: SEEDED_PERMANENT_ADMIN,
  });
  await expect(
    permanentRow.getByRole("button", { name: "Remove" }),
  ).toHaveCount(0);
  await expect(page.getByText(/can't be removed/)).toBeVisible();

  // 3. The outgoing admin removes themselves. That takes effect at once, so
  //    they are signed out and told why rather than dropped on a 403.
  const ownRow = page
    .locator("li")
    .filter({ has: page.locator(`input[value="${SEEDED_ADMIN}"]`) });
  await ownRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText(/This is your own address/)).toBeVisible();
  await page.getByRole("button", { name: "Remove them" }).click();

  await page.waitForURL(/error=removed-self/);
  await expect(page.getByText(/removed your own admin access/)).toBeVisible();

  // 4. The replacement can sign in and do admin work.
  await signInAsAdmin(page, NEW_ADMIN);
  await page.goto("/admin/admins");
  await expect(page.getByText(NEW_ADMIN).first()).toBeVisible();

  // 5. The ward is never locked out: the permanent row survived the whole thing.
  const { data } = await db()
    .from("admin_emails")
    .select("email, is_permanent")
    .eq("email", SEEDED_PERMANENT_ADMIN)
    .single();
  expect(data?.is_permanent).toBe(true);
});
