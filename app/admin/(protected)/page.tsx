import { QuickLinksManager } from "@/components/admin/QuickLinksManager";
import { ButtonLink } from "@/components/ui/Button";
import { getQuickLinks } from "@/lib/queries";

/**
 * The admin landing, and by now nearly the whole admin area.
 *
 * Events live in the ward's Google Calendar, the tool leaders already use.
 * Groups are edited on `/groups`, on the cards themselves. The home page's
 * fixed text is a set of constants in `lib/site.ts`. What is genuinely managed
 * on this site is the quick-links row below and who counts as an admin.
 */
export default async function AdminDashboard() {
  const quickLinks = await getQuickLinks();

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-6 py-6">
        <h2 className="text-xl font-bold tracking-tight">
          Events live in the ward Google Calendar
        </h2>

        <p className="max-w-prose text-ink-muted">
          Add, edit, or delete an event there and the site picks it up within
          about five minutes. The colour you give an event decides its chip on
          the site — see the handoff notes for the colour table.
        </p>

        <div>
          <ButtonLink
            href="https://calendar.google.com/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Open Google Calendar
            <span className="sr-only"> (opens in a new tab)</span>
          </ButtonLink>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold tracking-tight">Managed elsewhere</h2>
        <p className="max-w-prose text-ink-muted">
          Groups are edited on the groups page itself — while you&apos;re signed
          in, every card there has Edit and Delete on it.
        </p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <ButtonLink href="/groups" variant="secondary">
              Groups
            </ButtonLink>
          </li>
          <li>
            <ButtonLink href="/admin/admins" variant="secondary">
              Admins
            </ButtonLink>
          </li>
        </ul>
      </section>

      <QuickLinksManager links={quickLinks} />
    </div>
  );
}
