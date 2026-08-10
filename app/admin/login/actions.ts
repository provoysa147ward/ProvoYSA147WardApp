"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adminEmailSchema } from "@/lib/validation/admin";

import type { LoginState } from "./login-state";

/**
 * Request a magic link.
 *
 * Three things have to be true at once, which is what makes this fiddly:
 *
 *  1. A brand-new admin must be able to sign in. Their address is on the
 *     allowlist but they have no `auth.users` row yet, so `shouldCreateUser`
 *     has to be true or the very first sign-in could never happen.
 *  2. Nobody should be able to make the ward's mailer send to an arbitrary
 *     address. So the allowlist is checked here, before any email goes out.
 *  3. The reply must not reveal who is an admin. It is identical either way —
 *     a different message would let anyone enumerate the ward's admins one
 *     address at a time.
 *
 * The allowlist lookup uses the secret-key client because `admin_emails` is
 * admin-only under RLS and the caller is, by definition, not signed in yet.
 * That is the one pre-authentication use of that key in the codebase; the
 * answer is never returned to the browser.
 */
export async function requestMagicLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = adminEmailSchema.safeParse({
    email: formData.get("email") ?? "",
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
    };
  }

  const email = parsed.data.email;
  const { data: allowlisted } = await createAdminClient()
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (allowlisted) {
    const origin = (await headers()).get("origin");
    const supabase = await createClient();

    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });
    // Send errors are swallowed on purpose: reporting them would leak that the
    // address is on the list. A genuine outage looks like a link that never
    // arrives, which the resend button covers.
  }

  return { status: "sent" };
}

/**
 * Where sign-out is allowed to land. An allowlist rather than a free-form
 * `redirectTo`, so a crafted form post cannot turn sign-out into an open
 * redirect.
 */
const SIGN_OUT_DESTINATIONS = new Map<string, string>([
  ["default", "/admin/login"],
  ["removed", "/admin/login?error=removed"],
]);

export async function signOut(formData?: FormData): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // A Map, not an object literal: `reason=constructor` would resolve to an
  // inherited prototype member on an object, which is truthy, so the fallback
  // would never fire and a non-string would reach redirect().
  const reason = String(formData?.get("reason") ?? "default");
  redirect(
    SIGN_OUT_DESTINATIONS.get(reason) ?? SIGN_OUT_DESTINATIONS.get("default")!,
  );
}
