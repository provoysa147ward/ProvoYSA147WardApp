import "server-only";

import { NotAdminError, NotAuthenticatedError } from "@/lib/supabase/server";

/** Turns the admin guard's errors into something an admin can act on. */
export function guardMessage(error: unknown): string {
  if (error instanceof NotAdminError) {
    return "Your admin access was removed. Sign in again to check.";
  }
  if (error instanceof NotAuthenticatedError) {
    return "You've been signed out. Sign in again to continue.";
  }
  return "Something went wrong. Try again in a moment.";
}

/** First message per field: the one the admin should fix first. */
export function fieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
