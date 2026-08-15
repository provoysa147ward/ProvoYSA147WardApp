import { ButtonLink } from "@/components/ui/Button";

/**
 * The admin landing.
 *
 * Events are not managed here any more — they live in the ward's Google
 * Calendar, which is the tool leaders already use. What is left on this site is
 * everything Google has no opinion about: groups, page content, and who counts
 * as an admin.
 */
export default function AdminDashboard() {
  return (
    <div className="flex flex-col gap-6">
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
        <h2 className="text-xl font-bold tracking-tight">Managed here</h2>
        <ul className="flex flex-wrap gap-2">
          <li>
            <ButtonLink href="/admin/groups" variant="secondary">
              Groups
            </ButtonLink>
          </li>
          <li>
            <ButtonLink href="/admin/content" variant="secondary">
              Content
            </ButtonLink>
          </li>
          <li>
            <ButtonLink href="/admin/admins" variant="secondary">
              Admins
            </ButtonLink>
          </li>
        </ul>
      </section>
    </div>
  );
}
