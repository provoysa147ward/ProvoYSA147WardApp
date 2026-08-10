import { signOut } from "@/app/admin/login/actions";
import { Button, ButtonLink } from "@/components/ui/Button";

/**
 * The 403 boundary. Reached when someone is signed in but their address is not
 * on the allowlist — including an admin who was removed mid-session.
 *
 * Signing out is offered right here rather than left to the user to find:
 * a removed admin's session is otherwise valid, so it would keep landing them
 * on this page until it expired.
 */
export default function Forbidden() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">
        You don&apos;t have admin access
      </h1>
      <p className="text-ink-muted">
        You&apos;re signed in, but this address isn&apos;t on the ward&apos;s
        admin list. If your access was removed and that&apos;s a surprise, ask a
        current admin to add you back.
      </p>
      <div className="flex flex-wrap gap-3">
        <form action={signOut}>
          <input type="hidden" name="reason" value="removed" />
          <Button type="submit">Sign out</Button>
        </form>
        <ButtonLink href="/" variant="secondary">
          Back to the site
        </ButtonLink>
      </div>
    </div>
  );
}
