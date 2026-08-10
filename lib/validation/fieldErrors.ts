/**
 * Collapse Zod issues into one message per field, for inline display.
 *
 * Pure and client-safe on purpose: both the public submission action and the
 * admin actions use it, and the public form's tests import the action module
 * directly — so this must not sit behind a `server-only` guard.
 */
export function fieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    // First message per field: the one the user should fix first.
    errors[key] ??= issue.message;
  }
  return errors;
}
