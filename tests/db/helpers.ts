import { execFileSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test harness for the local Supabase stack.
 *
 * These tests talk to PostgREST exactly as a browser would, so what they prove
 * is what an attacker would actually be able to do — not what a mock says.
 */

export interface LocalStack {
  apiUrl: string;
  publishableKey: string;
  secretKey: string;
}

let cached: LocalStack | undefined;

export function localStack(): LocalStack {
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
  cached = {
    apiUrl: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
  };
  return cached;
}

/** A client with no session at all — what a random visitor gets. */
export function anonClient(): SupabaseClient {
  const { apiUrl, publishableKey } = localStack();
  return createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Bypasses RLS. Used only to arrange fixtures and to assert on real state. */
export function serviceClient(): SupabaseClient {
  const { apiUrl, secretKey } = localStack();
  return createClient(apiUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

/**
 * Create a confirmed user and return a client carrying their session, so the
 * request arrives as the `authenticated` role with their email in the JWT.
 */
export async function createUser(email: string): Promise<TestUser> {
  const { apiUrl, publishableKey } = localStack();
  const service = serviceClient();
  const password = "test-password-1234";

  // Remove a leftover from an earlier run so the suite is re-runnable.
  const { data: existing } = await service.auth.admin.listUsers();
  const stale = existing?.users.find((user) => user.email === email);
  if (stale) await service.auth.admin.deleteUser(stale.id);

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${email}: ${error?.message}`);
  }

  const client = createClient(apiUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw new Error(`Could not sign in ${email}: ${signInError.message}`);
  }

  return { id: data.user.id, email, client };
}

export async function deleteUser(id: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(id);
}

export async function addAdmin(email: string, isPermanent = false) {
  const { error } = await serviceClient()
    .from("admin_emails")
    .upsert({ email, is_permanent: isPermanent }, { onConflict: "email" });
  if (error) throw new Error(`Could not add admin ${email}: ${error.message}`);
}

export async function removeAdmin(email: string) {
  await serviceClient().from("admin_emails").delete().eq("email", email);
}

/**
 * The seeded permanent admin row.
 *
 * Tests use this rather than creating their own, because a permanent row is by
 * design impossible to clean up: the trigger refuses the delete *and* refuses
 * to clear the flag, so every run would leave one behind. Requires
 * `supabase db reset` to have run — the message says so if it hasn't.
 */
export const SEEDED_PERMANENT_EMAIL = "ward-email@example.com";

export async function assertSeededPermanentAdmin(): Promise<void> {
  const { data } = await serviceClient()
    .from("admin_emails")
    .select("email, is_permanent")
    .eq("email", SEEDED_PERMANENT_EMAIL)
    .maybeSingle();

  if (!data?.is_permanent) {
    throw new Error(
      `Expected the seeded permanent admin ${SEEDED_PERMANENT_EMAIL}. Run \`supabase db reset\` first.`,
    );
  }
}

/** ISO date `days` from today, for fixtures that must not be in the past. */
export function isoDateFromToday(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export interface EventFixture {
  status?: string;
  title?: string;
  category?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string | null;
  location?: string;
  description?: string | null;
  repeats_weekly?: boolean;
  repeat_until?: string | null;
  submitter_name?: string;
  submitter_contact?: string;
}

export function eventFixture(overrides: EventFixture = {}) {
  return {
    status: "approved",
    title: "Test Event",
    category: "social",
    event_date: isoDateFromToday(7),
    start_time: "19:00:00",
    end_time: "21:00:00",
    location: "Ward building",
    description: null,
    repeats_weekly: false,
    repeat_until: null,
    submitter_name: "Casey Submitter",
    submitter_contact: "casey@example.com",
    ...overrides,
  };
}

/** Insert an event bypassing RLS, returning its id. */
export async function seedEvent(overrides: EventFixture = {}): Promise<string> {
  const { data, error } = await serviceClient()
    .from("events")
    .insert(eventFixture(overrides))
    .select("id")
    .single();
  if (error) throw new Error(`Could not seed event: ${error.message}`);
  return data.id as string;
}

export async function deleteEvent(id: string) {
  await serviceClient().from("events").delete().eq("id", id);
}
