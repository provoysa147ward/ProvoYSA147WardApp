import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseSecretKey, supabaseUrl } from "./env";

/**
 * Supabase client authenticated with the secret key. It bypasses RLS entirely,
 * so it is the one client in the codebase with no safety net.
 *
 * Rules for using it:
 *  - `import "server-only"` above makes importing this from a client component
 *    a build error, so the key can never reach the browser.
 *  - Call `requireAdmin()` first, every time. RLS is not going to catch a
 *    mistake here.
 *  - Reach for it only when RLS genuinely cannot express the operation — the
 *    session client in `lib/supabase/server.ts` is the default.
 */
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseSecretKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
