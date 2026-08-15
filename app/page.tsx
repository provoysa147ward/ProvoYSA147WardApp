import Image from "next/image";
import Link from "next/link";

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

/** "Coming up" is the next week; the calendar page is there for the rest. */
const UPCOMING_DAYS = 7;

export default async function Home() {
  const [settings, calendar, quickLinks] = await Promise.all([
    getSiteSettings(),
    getCalendarEvents(),
    getQuickLinks(),
  ]);

  const upcoming = calendar.ok
    ? upcomingOccurrences(calendar.events, { withinDays: UPCOMING_DAYS })
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
          <EmptyState emoji="🗓️" title="Nothing on in the next week.">
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
 * The first thing a new member should see: one button into the group chat,
 * wearing the same picture the group wears in GroupMe so it is recognisable
 * before the words are read.
 *
 * Deliberately just the button — no card, no explanatory copy. Anyone who
 * needs the ward GroupMe knows what it is, and a paragraph here only puts
 * words between them and the tap.
 *
 * Its colours are the card's own (see `--color-groupme-*` in `globals.css`),
 * so the picture sits on a field that matches its own and the two read as one
 * object rather than a photo pasted onto a button.
 *
 * Built from a plain `Link` rather than `ButtonLink`: at this size it is a
 * card, not a button, and forcing it through that primitive would mean
 * fighting the shared pill radius and padding with overrides that Tailwind
 * resolves by stylesheet order rather than by the order they are written.
 *
 * The picture is a rounded square rather than a circle: it is a bordered card
 * with the ward's name along the bottom, and a circular crop would cut through
 * both. `alt` is empty because the link's own text already says where this
 * goes — announcing the picture too would only repeat it.
 */
function GroupMeBanner() {
  return (
    <Link
      href={GROUPME_JOIN_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-groupme-border bg-groupme-bg px-6 py-6 text-groupme-fg transition hover:bg-groupme-bg-hover sm:flex-row sm:gap-6 sm:px-10"
    >
      <Image
        src="/groupme.jpg"
        alt=""
        width={176}
        height={176}
        className="h-36 w-36 shrink-0 rounded-xl sm:h-44 sm:w-44"
      />
      <span className="text-center text-2xl font-bold tracking-tight sm:text-left sm:text-3xl">
        Join the Ward GroupMe
        <span className="sr-only"> (opens in a new tab)</span>
      </span>
    </Link>
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
