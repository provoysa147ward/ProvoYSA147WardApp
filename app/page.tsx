import { CategoryChip } from "@/components/calendar/EventChip";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatDayLabel,
  formatTimeRange,
  toUtcIso,
  wardToday,
} from "@/lib/date";
import { upcomingOccurrences, type EventOccurrence } from "@/lib/events";
import {
  getPublicEvents,
  getQuickLinks,
  getSiteSettings,
  type SiteSettings,
} from "@/lib/queries";

const UPCOMING_COUNT = 5;

export default async function Home() {
  const [settings, events, quickLinks] = await Promise.all([
    getSiteSettings(),
    getPublicEvents(),
    getQuickLinks(),
  ]);

  const upcoming = upcomingOccurrences(events, { limit: UPCOMING_COUNT });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <Announcement settings={settings} />

      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Provo YSA 147th Ward
        </h1>

        <p className="max-w-prose text-lg text-ink-muted">
          {settings.welcomeBlurb ||
            "Welcome! This is where we keep track of what's happening in the ward."}
        </p>

        {settings.sundayMeetingInfo ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 font-semibold">
            {settings.sundayMeetingInfo}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/calendar">See the calendar</ButtonLink>
          <ButtonLink href="/submit" variant="secondary">
            Suggest an event
          </ButtonLink>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">Coming up</h2>
          <ButtonLink href="/calendar" variant="quiet">
            Full calendar →
          </ButtonLink>
        </div>

        {upcoming.length === 0 ? (
          <EmptyState emoji="🗓️" title="Nothing scheduled yet.">
            Know about something?{" "}
            <a href="/submit" className="font-semibold text-accent underline">
              Suggest an event
            </a>
            .
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((occurrence) => (
              <li key={occurrence.key}>
                <UpcomingRow occurrence={occurrence} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {quickLinks.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">Quick links</h2>
          <ul className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <li key={link.id}>
                <ButtonLink
                  href={link.url}
                  variant="secondary"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Hidden entirely when unset or past its expiry date. */
function Announcement({ settings }: { settings: SiteSettings }) {
  const announcement = settings.announcement.trim();
  if (!announcement) return null;

  if (
    settings.announcementExpires &&
    settings.announcementExpires < wardToday()
  ) {
    return null;
  }

  return (
    <aside className="rounded-2xl border border-cat-social-border bg-cat-social-bg px-4 py-3 text-cat-social-fg">
      <p className="font-semibold">
        <span className="sr-only">Announcement: </span>
        {announcement}
      </p>
    </aside>
  );
}

function UpcomingRow({ occurrence }: { occurrence: EventOccurrence }) {
  const { event } = occurrence;

  return (
    <article className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{event.title}</h3>
          <CategoryChip category={event.category} />
        </div>
        <p className="text-sm text-ink-muted">{event.location}</p>
      </div>

      <p className="text-sm font-semibold text-ink-muted sm:text-right">
        <time dateTime={toUtcIso(occurrence.start)}>
          {formatDayLabel(occurrence.date)}
        </time>
        <span className="block font-normal">
          {formatTimeRange(event.startTime, event.endTime)}
        </span>
      </p>
    </article>
  );
}
