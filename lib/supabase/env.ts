/**
 * Supabase environment variables, read through one place so a missing value
 * fails loudly at the call site instead of producing a client that 401s later.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/** Safe to ship to the browser; every request it makes is subject to RLS. */
export function supabasePublishableKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Bypasses RLS entirely. Server-only — see lib/supabase/admin.ts. */
export function supabaseSecretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}
