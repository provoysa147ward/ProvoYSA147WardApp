import { CategoryChip } from "@/components/calendar/EventChip";
import { EventsUnavailable } from "@/components/calendar/EventsUnavailable";
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
  getCalendarEvents,
  getQuickLinks,
  getSiteSettings,
  type SiteSettings,
} from "@/lib/queries";
import { GROUPME_JOIN_URL } from "@/lib/site";

const UPCOMING_COUNT = 5;

export default async function Home() {
  const [settings, calendar, quickLinks] = await Promise.all([
    getSiteSettings(),
    getCalendarEvents(),
    getQuickLinks(),
  ]);

  const upcoming = calendar.ok
    ? upcomingOccurrences(calendar.events, { limit: UPCOMING_COUNT })
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <Announcement settings={settings} />

      <GroupMeBanner />

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
          <ButtonLink href="/survey" variant="secondary">
            New Member Survey
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

        {!calendar.ok ? (
          <EventsUnavailable />
        ) : upcoming.length === 0 ? (
          <EmptyState emoji="🗓️" title="Nothing scheduled yet.">
            Know about something?{" "}
            <a
              href={GROUPME_JOIN_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold text-accent underline"
            >
              Share it in the ward GroupMe
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

/**
 * The first thing a new member should see: how to get into the group chat.
 *
 * A labelled `<section>` rather than a heading, so the page outline still opens
 * at the H1 below it.
 */
function GroupMeBanner() {
  return (
    <section
      aria-label="Join the ward GroupMe"
      className="flex flex-col gap-3 rounded-2xl border border-cat-social-border bg-cat-social-bg px-6 py-6 text-cat-social-fg sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <p className="max-w-prose font-semibold">
        New here? The ward GroupMe is where plans get made — join it and
        you&apos;ll know what&apos;s happening.
      </p>

      <ButtonLink
        href={GROUPME_JOIN_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="shrink-0"
      >
        Join the Ward GroupMe
        <span className="sr-only"> (opens in a new tab)</span>
      </ButtonLink>
    </section>
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
        {event.location ? (
          <p className="text-sm text-ink-muted">{event.location}</p>
        ) : null}
      </div>

      <p className="text-sm font-semibold text-ink-muted sm:text-right">
        <time dateTime={toUtcIso(occurrence.start)}>
          {formatDayLabel(occurrence.date)}
        </time>
        <span className="block font-normal">
          {formatTimeRange(event.startTime, event.endTime, event.allDay)}
        </span>
      </p>
    </article>
  );
}
