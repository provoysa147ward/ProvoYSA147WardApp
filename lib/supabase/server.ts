import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Request-scoped Supabase client that reads and refreshes the auth cookies.
 *
 * Safe in server components, route handlers, and server actions: cookie writes
 * are only possible in the latter two, so a failed write from a server
 * component is swallowed (the proxy refreshes the session instead).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // proxy.ts refreshes the session for these requests.
        }
      },
    },
  });
}

export interface AdminUser {
  id: string;
  email: string;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not signed in.");
    this.name = "NotAuthenticatedError";
  }
}

export class NotAdminError extends Error {
  constructor() {
    super("Your admin access was removed.");
    this.name = "NotAdminError";
  }
}

/**
 * Why the caller is or isn't an admin. The three states are kept apart because
 * they lead to different responses: sign in, 403, or proceed.
 */
export type AdminCheck =
  | { status: "anonymous" }
  | { status: "not-admin"; email: string }
  | { status: "admin"; user: AdminUser };

/**
 * Resolve the caller's admin status.
 *
 * Two deliberate choices. First, `getUser()` rather than `getSession()`: only
 * the former revalidates the token with Supabase, so a forged cookie cannot
 * satisfy it. Second, the allowlist check is a select against `admin_emails`
 * as the user themselves — RLS returns rows only to an admin, so the app's
 * answer cannot drift out of agreement with the database's own.
 */
export async function checkAdmin(): Promise<AdminCheck> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { status: "anonymous" };

  const email = user.email.toLowerCase().trim();

  const { data, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { status: "not-admin", email };

  return { status: "admin", user: { id: user.id, email } };
}

/**
 * Guard for every admin server action. Actions are independently-invocable
 * POST endpoints, so each one re-checks rather than trusting the layout that
 * rendered the form.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const check = await checkAdmin();

  if (check.status === "anonymous") throw new NotAuthenticatedError();
  if (check.status === "not-admin") throw new NotAdminError();

  return check.user;
}
