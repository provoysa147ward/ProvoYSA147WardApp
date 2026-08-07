import { ButtonLink } from "@/components/ui/Button";

/**
 * The 401 boundary. Reached when `unauthorized()` is called — in practice, an
 * admin page rendered without a session (usually an expired one).
 */
export default function Unauthorized() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">Please sign in</h1>
      <p className="text-ink-muted">
        This part of the site is for ward admins. Sign in with your email and
        we&apos;ll send you a link.
      </p>
      <ButtonLink href="/admin/login">Go to sign in</ButtonLink>
    </div>
  );
}
