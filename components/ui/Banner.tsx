import type { AdminActionState } from "@/lib/adminActionState";

/**
 * The result of an admin form submission, said out loud.
 *
 * An error is `role="alert"` because it interrupts what someone was doing; a
 * success is `role="status"` because it does not. Every admin form renders one
 * of these, so the two never drift apart into different wordings or colours.
 */
export function Banner({ state }: { state: AdminActionState }) {
  if (state.formError) return <ErrorBanner message={state.formError} />;

  if (state.status === "success" && state.message) {
    return (
      <p
        role="status"
        className="rounded-xl border border-notice-border bg-notice-bg px-4 py-2 text-sm font-semibold text-notice-fg"
      >
        {state.message}
      </p>
    );
  }

  return null;
}

/** The error half on its own, for callers holding a message rather than a state. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
    >
      {message}
    </p>
  );
}
