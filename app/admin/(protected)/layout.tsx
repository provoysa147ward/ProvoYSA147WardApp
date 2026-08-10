import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";

import { signOut } from "@/app/admin/login/actions";
import { Button } from "@/components/ui/Button";
import { checkAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const ADMIN_LINKS = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/admins", label: "Admins" },
] as const;

/**
 * The authoritative admin gate.
 *
 * `proxy.ts` redirects signed-out visitors before this renders, but that is a
 * convenience only — this check is the one that must hold. It runs on the
 * server for every admin page, and every admin action re-checks independently
 * via `requireAdmin()` because actions can be invoked without ever rendering a
 * page. RLS is the final backstop under both.
 *
 * It lives in a `(protected)` route group so that `/admin/login` — which a
 * signed-out admin has to be able to reach — does not inherit it. Any new
 * admin page belongs inside this group; anything that must stay reachable
 * without a session belongs beside it.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const check = await checkAdmin();

  if (check.status === "anonymous") unauthorized();
  if (check.status === "not-admin") forbidden();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Ward admin</h1>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>

        <p className="text-sm text-ink-muted">
          Signed in as <strong className="font-semibold">{check.user.email}</strong>
        </p>

        <nav aria-label="Admin">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            {ADMIN_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center text-ink-muted hover:text-accent"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {children}
    </div>
  );
}
