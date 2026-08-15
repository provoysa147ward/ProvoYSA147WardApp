import type { calendar_v3 } from "googleapis";

import { addCalendarDays, toUtcIso, wardInstant, type IsoDate } from "../../../lib/date";

/**
 * A stand-in for the ward's Google Calendar, fed to the app through
 * `CALENDAR_FIXTURES` so the end-to-end suite exercises the real mapping and
 * the real views without live Google credentials.
 *
 * Built from day offsets rather than checked in as dated JSON: the site only
 * shows events from today forward, so fixed dates would quietly stop covering
 * anything the day they passed — the same reason `supabase/seed.sql` dates its
 * rows relative to `current_date`.
 *
 * Between them the entries cover every awkward shape the mapping handles:
 * timed, past-midnight, no end time, all-day (single and multi-day), an
 * untitled and unplaced event, an HTML description, a cancelled instance, and
 * one carrying organizer and attendee details that must never reach the site.
 */

/** Titles the specs assert on, so a fixture edit cannot silently orphan them. */
export const FIXTURE_TITLES = {
  social: "Break the Fast",
  sports: "Volleyball",
  pastMidnight: "Late-Night Game Night",
  allDay: "Ward Temple Trip",
  multiDay: "Youth Conference",
  untitled: "(No title)",
  beyondWeek: "Canyon Service Project",
  cancelled: "Cancelled Fireside",
} as const;

/** Contact details planted in the fixture that must not appear on the site. */
export const FIXTURE_PRIVATE_DETAILS = ["riley@example.com", "Riley Fields"];

function timed(date: IsoDate, time: string): calendar_v3.Schema$EventDateTime {
  return { dateTime: toUtcIso(wardInstant(date, time)) };
}

export function buildCalendarFixture(
  today: IsoDate,
): calendar_v3.Schema$Event[] {
  const day = (offset: number) => addCalendarDays(today, offset);

  return [
    {
      id: "fixture-volleyball",
      status: "confirmed",
      summary: FIXTURE_TITLES.sports,
      location: "Stake center gym",
      colorId: "2", // Sage -> sports
      start: timed(day(1), "20:00"),
      end: timed(day(1), "22:00"),
    },
    {
      id: "fixture-break-the-fast",
      status: "confirmed",
      summary: FIXTURE_TITLES.social,
      location: "Ward building cultural hall",
      description: "Bring a side if you can.",
      colorId: "4", // Flamingo -> social
      start: timed(day(2), "13:00"),
      end: timed(day(2), "15:00"),
      // None of this may reach the public site.
      creator: { email: "riley@example.com", displayName: "Riley Fields" },
      organizer: { email: "riley@example.com", displayName: "Riley Fields" },
      attendees: [
        { email: "riley@example.com", displayName: "Riley Fields" },
      ],
    },
    {
      id: "fixture-institute",
      status: "confirmed",
      summary: "Institute Class",
      location: "Institute building, room 210",
      description:
        "<p>Doctrine and Covenants this semester.</p><p>Bring your <b>scriptures</b> &amp; a friend.</p>",
      colorId: "1", // Lavender -> spiritual
      start: timed(day(3), "19:00"),
      end: timed(day(3), "20:30"),
    },
    {
      id: "fixture-temple-trip",
      status: "confirmed",
      summary: FIXTURE_TITLES.allDay,
      location: "Provo City Center Temple",
      colorId: "3", // Grape -> spiritual
      start: { date: day(4) },
      end: { date: day(5) }, // Exclusive: a single day.
    },
    {
      id: "fixture-game-night",
      status: "confirmed",
      summary: FIXTURE_TITLES.pastMidnight,
      location: "Apartment 12 clubhouse",
      description: "Runs past midnight — come whenever.",
      colorId: "11", // Tomato -> social
      start: timed(day(5), "21:30"),
      end: timed(day(6), "00:30"),
    },
    {
      id: "fixture-youth-conference",
      status: "confirmed",
      summary: FIXTURE_TITLES.multiDay,
      location: "Aspen Grove",
      colorId: "10", // Basil -> sports
      start: { date: day(6) },
      end: { date: day(9) }, // Exclusive: the 6th, 7th, and 8th.
    },
    {
      id: "fixture-service-project",
      status: "confirmed",
      summary: FIXTURE_TITLES.beyondWeek,
      location: "Rock Canyon trailhead",
      colorId: "7", // Peacock -> service
      start: timed(day(9), "09:00"),
      // No end time at all, which Google allows.
    },
    {
      id: "fixture-untitled",
      status: "confirmed",
      // No summary, no location, and no colour: every fallback at once.
      start: timed(day(10), "18:00"),
      end: timed(day(10), "19:00"),
    },
    {
      id: "fixture-cancelled",
      status: "cancelled",
      summary: FIXTURE_TITLES.cancelled,
      location: "Ward building chapel",
      colorId: "1",
      start: timed(day(2), "19:00"),
      end: timed(day(2), "20:00"),
    },
  ];
}
