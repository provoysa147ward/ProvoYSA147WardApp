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
import { getCalendarEvents, getQuickLinks } from "@/lib/queries";
import {
  ANNOUNCEMENT,
  ANNOUNCEMENT_EXPIRES,
  GROUPME_JOIN_URL,
  SUNDAY_MEETING_INFO,
  SURVEY_URL,
  WELCOME_BLURB,
} from "@/lib/site";

/** "Coming up" is the next week; the calendar page is there for the rest. */
const UPCOMING_DAYS = 7;

export default async function Home() {
  const [calendar, quickLinks] = await Promise.all([
    getCalendarEvents(),
    getQuickLinks(),
  ]);

  const upcoming = calendar.ok
    ? upcomingOccurrences(calendar.events, { withinDays: UPCOMING_DAYS })
    : [];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <Announcement />

      <GroupMeBanner />

      <SurveyBanner />

      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Provo YSA 147th Ward
        </h1>

        <p className="max-w-prose text-lg text-ink-muted">{WELCOME_BLURB}</p>

        {SUNDAY_MEETING_INFO ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 font-semibold">
            {SUNDAY_MEETING_INFO}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/calendar">See the calendar</ButtonLink>
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

/**
 * The second of the two front-door actions, sitting directly under the
 * GroupMe card and matching its size so the pair reads as one block: join the
 * chat, then tell us who you are.
 *
 * Points straight at the ward's Google Form rather than at `/survey`, because
 * a page whose only content is a link to the form is a step that costs a tap
 * and gives nothing back. `/survey` still exists for anyone who has the URL.
 *
 * Solid accent rather than the GroupMe card's own colours: it is the site
 * speaking here, not GroupMe, and the contrast keeps the two from blurring
 * into a single stripe.
 */
function SurveyBanner() {
  return (
    <Link
      href={SURVEY_URL}
      target="_blank"
      rel="noreferrer noopener"
      className="flex w-full items-center justify-center rounded-2xl bg-accent px-6 py-8 text-center text-2xl font-bold tracking-tight text-cream transition hover:opacity-90 sm:px-10 sm:text-3xl"
    >
      New Member Survey
      <span className="sr-only"> (opens in a new tab)</span>
    </Link>
  );
}

/** Hidden entirely when unset or past its expiry date. */
function Announcement() {
  const announcement = ANNOUNCEMENT.trim();
  if (!announcement) return null;

  if (ANNOUNCEMENT_EXPIRES && ANNOUNCEMENT_EXPIRES < wardToday()) return null;

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
