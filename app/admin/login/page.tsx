import type { Metadata } from "next";

import { MagicLinkForm } from "@/components/forms/MagicLinkForm";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGES: Record<string, string> = {
  expired:
    "That sign-in link has already been used or has expired. Links work once and last an hour — send yourself a fresh one below.",
  invalid:
    "That sign-in link didn't look right. Send yourself a fresh one below.",
  removed:
    "Your admin access was removed, so you've been signed out. If that's a surprise, ask another admin to add you back.",
  "removed-self":
    "You removed your own admin access and have been signed out. If that wasn't what you meant, ask another admin to add you back.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">
          For ward admins. You&apos;ll get a link by email — no password to
          remember or hand over.
        </p>
      </div>

      {message ? (
        <p
          role="alert"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
        >
          {message}
        </p>
      ) : null}

      <MagicLinkForm />
    </div>
  );
}
