import { redirect } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where a magic link lands.
 *
 * Two shapes are accepted, because which one arrives depends on the email
 * template and the ward will not want a login outage over a template edit:
 *
 *  - `token_hash` + `type` — what the project's own template sends, exchanged
 *    with `verifyOtp`. This is the intended path.
 *  - `code` — what Supabase's stock template sends, exchanged with
 *    `exchangeCodeForSession`. Supporting it means sign-in still works if
 *    nobody ever pastes the custom template into the dashboard.
 *
 * The old `#access_token` fragment flow is deliberately not supported: a URL
 * fragment never reaches the server, so the exchange could not stay server-side.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    // A used or expired link is by far the most common failure, so it gets a
    // friendly page with a resend button rather than a raw error.
    redirect(error ? "/admin/login?error=expired" : "/admin");
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    redirect(error ? "/admin/login?error=expired" : "/admin");
  }

  redirect("/admin/login?error=invalid");
}
