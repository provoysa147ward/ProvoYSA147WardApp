import { createBrowserClient } from "@supabase/ssr";

import { supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Browser-side Supabase client. Only used for auth flows (requesting a magic
 * link, signing out) — every read goes through a server component and every
 * write through a server action.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabasePublishableKey());
}
