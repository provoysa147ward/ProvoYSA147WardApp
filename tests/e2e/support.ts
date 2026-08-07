import { execFileSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

/**
 * Helpers shared by the end-to-end specs: talking to the local stack directly
 * for arrangement and assertions, and reading magic links out of the Supabase
 * CLI's bundled mail catcher (Mailpit).
 */

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

let cached: { apiUrl: string; secretKey: string } | undefined;

function stack() {
  if (cached) return cached;

  let raw: string;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(
      "Could not reach the local Supabase stack. Run `supabase start` first.",
    );
  }

  const status = JSON.parse(raw) as Record<string, string>;
  cached = { apiUrl: status.API_URL, secretKey: status.SECRET_KEY };
  return cached;
}

/** Bypasses RLS — arrangement and assertions only, never the thing under test. */
export function db(): SupabaseClient {
  const { apiUrl, secretKey } = stack();
  return createClient(apiUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
}

interface MailpitMessage {
  ID: string;
  To: { Address: string }[];
}

/**
 * Poll the mail catcher for a sign-in link addressed to `email`.
 *
 * Polling rather than a fixed wait: the send is asynchronous, and a sleep long
 * enough to be reliable would slow every run.
 */
export async function waitForSignInLink(
  email: string,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const listResponse = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=25`);
    const list = (await listResponse.json()) as { messages?: MailpitMessage[] };

    const match = (list.messages ?? []).find((message) =>
      message.To.some((to) => to.Address.toLowerCase() === email.toLowerCase()),
    );

    if (match) {
      const detail = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${match.ID}`)
      ).json()) as { HTML?: string; Text?: string };

      const body = `${detail.HTML ?? ""} ${detail.Text ?? ""}`;
      const link = [...body.matchAll(/https?:\/\/[^\s"'<>]+/g)]
        .map((found) => found[0].replace(/&amp;/g, "&"))
        .find((url) => url.includes("/auth/confirm"));

      if (link) return link;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`No sign-in link arrived for ${email} within ${timeoutMs}ms.`);
}

/**
 * Sign in as an allowlisted admin.
 *
 * The token is minted through Supabase's admin API rather than by driving the
 * login form and reading the mailbox. The browser still follows a real
 * `/auth/confirm?token_hash=...` link, so the verification path under test is
 * identical — this only skips the email hop, which is slow and subject to
 * Supabase's per-address send throttle. The full email round trip is covered
 * once, in the reused-link spec.
 */
export async function signInAsAdmin(page: Page, email: string): Promise<void> {
  // `generateLink` only works for a user that already exists, so someone
  // signing in for the very first time goes through the real form and mailbox —
  // which is the interesting case anyway, since that is the path a newly added
  // admin actually takes.
  if (!(await authUserExists(email))) {
    await signInThroughEmail(page, email);
    return;
  }

  const { data, error } = await db().auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (error || !data.properties?.hashed_token) {
    throw new Error(
      `Could not mint a sign-in link for ${email}: ${error?.message}`,
    );
  }

  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await page.getByText(`Signed in as ${email}`).waitFor();
}

async function authUserExists(email: string): Promise<boolean> {
  const { data } = await db().auth.admin.listUsers();
  return (data?.users ?? []).some(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

/** The genuine article: request a link, read the mailbox, follow it. */
async function signInThroughEmail(page: Page, email: string): Promise<void> {
  await clearMailbox();

  await page.goto("/admin/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByText("Check your email").waitFor();

  await page.goto(await waitForSignInLink(email));
  await page.getByText(`Signed in as ${email}`).waitFor();
}

export async function signOut(page: Page): Promise<void> {
  await page.goto("/admin");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/admin\/login/);
}

/** Remove a user so a spec that creates one can be run repeatedly. */
export async function deleteAuthUser(email: string): Promise<void> {
  const service = db();
  const { data } = await service.auth.admin.listUsers();
  const user = data?.users.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
  );
  if (user) await service.auth.admin.deleteUser(user.id);
}

export const SEEDED_ADMIN = "admin@example.com";
export const SEEDED_PERMANENT_ADMIN = "ward-email@example.com";
