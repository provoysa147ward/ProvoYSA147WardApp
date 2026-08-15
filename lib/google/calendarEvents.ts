import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { google, type calendar_v3 } from "googleapis";
import { unstable_cache } from "next/cache";

import { categoryFromGoogleColor } from "@/lib/categories";
import {
  addCalendarDays,
  firstDayOfMonth,
  monthOf,
  shiftMonth,
  toUtcIso,
  wardInstant,
  wardToday,
  wardWallClock,
  type IsoDate,
} from "@/lib/date";
import type { WardEvent } from "@/lib/events";

/**
 * The ward's Google Calendar, read as the site's events.
 *
 * Leaders manage events in Google, which is the tool they already use; the
 * site only ever reads. Two properties matter:
 *
 *  - **Nothing here may take the site down.** The fetch throws on failure so a
 *    failure is never cached, and `lib/queries.ts` turns that into a typed
 *    result the pages render as a friendly empty region. A slow Google is a
 *    failure too, hence the explicit request timeout.
 *  - **The mapping is pure.** `mapGoogleEvent` does no I/O, which is what makes
 *    the awkward cases — all-day spans, past-midnight events, DST, cancelled
 *    instances — cheap to test hard.
 */

/** Read-only: the site has no business writing to the ward's calendar. */
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";

/** How far either side of today events are fetched. */
const MONTHS_BACK = 3;
const MONTHS_FORWARD = 13;

/** Google's per-page maximum. A ward calendar will never come close. */
const MAX_RESULTS = 2500;

/** A slow Google must not hang a page render. */
const REQUEST_TIMEOUT_MS = 5_000;

/** How long a successful read is reused for. */
const CACHE_SECONDS = 300;

const CACHE_KEY = "ward-calendar-events";

/** Google allows an untitled event; the site still needs something to show. */
const UNTITLED = "(No title)";

interface GoogleCredentials {
  clientEmail: string;
  privateKey: string;
  calendarId: string;
}

function credentials(): GoogleCredentials | null {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!clientEmail || !privateKey || !calendarId) return null;

  return {
    clientEmail,
    // Env vars carry the key with literal backslash-n rather than newlines.
    privateKey: privateKey.replace(/\\n/g, "\n"),
    calendarId,
  };
}

/**
 * Whether events can be read at all. Without credentials the rest of the site
 * still works; only the events region says it is unavailable.
 */
export function canReadCalendar(): boolean {
  return credentials() !== null || fixturePath() !== null;
}

/** Fixtures live in exactly one folder. See `fixturePath`. */
const FIXTURE_DIR = "tests/e2e/fixtures";

/**
 * A JSON array of Google event items, substituted for the API.
 *
 * This is what lets the end-to-end suite exercise the real mapping and the
 * real views without live Google credentials. `CALENDAR_FIXTURES` names a file
 * inside the fixtures folder rather than an arbitrary path: a stray value then
 * cannot point the site at some other file, and the bundler can see that the
 * read is scoped to a subfolder instead of tracing the whole project into the
 * deployment. It is also refused outright on Vercel, so no environment
 * variable can serve canned data to an actual visitor. (`NODE_ENV` cannot be
 * the guard: the e2e suite runs a production build on purpose.)
 */
function fixturePath(): string | null {
  if (process.env.VERCEL) return null;

  const name = process.env.CALENDAR_FIXTURES;
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) {
    return null;
  }
  return path.join(process.cwd(), FIXTURE_DIR, name);
}

/** The window fetched, as ward calendar dates: `to` is exclusive. */
export function fetchWindow(today: IsoDate): { from: IsoDate; to: IsoDate } {
  const month = monthOf(today);
  return {
    from: firstDayOfMonth(shiftMonth(month, -MONTHS_BACK)),
    to: firstDayOfMonth(shiftMonth(month, MONTHS_FORWARD + 1)),
  };
}

/**
 * Every event instance in the window, straight from Google.
 *
 * `singleEvents: true` makes Google expand recurrence into instances — its
 * RRULE handling covers exceptions and moved instances that the site's own
 * weekly-only expansion never could — and is what `orderBy: "startTime"`
 * requires. Throws on any failure, including a timeout, so `unstable_cache`
 * never stores one.
 */
async function fetchGoogleEvents(): Promise<calendar_v3.Schema$Event[]> {
  const creds = credentials();
  if (!creds) throw new Error("Google Calendar credentials are not set.");

  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: [CALENDAR_SCOPE],
  });
  const calendar = google.calendar({ version: "v3", auth });
  const window = fetchWindow(wardToday());

  const items: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  // Pagination is precautionary rather than expected: a ward calendar will
  // never approach 2500 instances in sixteen months.
  do {
    const response = await calendar.events.list(
      {
        calendarId: creds.calendarId,
        singleEvents: true,
        orderBy: "startTime",
        timeMin: toUtcIso(wardInstant(window.from, "00:00")),
        timeMax: toUtcIso(wardInstant(window.to, "00:00")),
        maxResults: MAX_RESULTS,
        pageToken,
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    items.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items;
}

const cachedGoogleEvents = unstable_cache(fetchGoogleEvents, [CACHE_KEY], {
  revalidate: CACHE_SECONDS,
});

/**
 * The ward calendar as `WardEvent`s. Throws if Google cannot be reached —
 * `lib/queries.ts` owns what the site does about that.
 */
export async function loadWardCalendarEvents(): Promise<WardEvent[]> {
  const fixture = fixturePath();
  const items = fixture
    ? ((JSON.parse(
        await readFile(fixture, "utf8"),
      ) as calendar_v3.Schema$Event[]) ?? [])
    : await cachedGoogleEvents();

  return items.flatMap(mapGoogleEvent);
}

/**
 * One Google event item as the site's events.
 *
 * Usually one `WardEvent`, but an all-day event covering several days becomes
 * one per day, and a cancelled instance becomes none. Every result of a
 * multi-day event shares the Google id — so `WardEvent.id` is *not* unique
 * across the list, and the occurrence key (`id@date`) is the only unique
 * handle.
 *
 * Attendee, organizer, and creator fields are deliberately never read. The
 * public site shows what a leader typed into the event and nothing else.
 */
export function mapGoogleEvent(item: calendar_v3.Schema$Event): WardEvent[] {
  if (item.status === "cancelled") return [];

  const common = {
    id: item.id ?? "",
    title: item.summary?.trim() || UNTITLED,
    category: categoryFromGoogleColor(item.colorId),
    location: item.location?.trim() ?? "",
    description: toPlainText(item.description),
    repeatsWeekly: false,
    repeatUntil: null,
  };

  if (item.start?.date) {
    // All-day events end on an *exclusive* date, so a one-day event reads
    // 19th to 20th.
    const from = item.start.date;
    const to = item.end?.date;
    const days: IsoDate[] = [from];
    if (to) {
      for (let day = addCalendarDays(from, 1); day < to; day = addCalendarDays(day, 1)) {
        days.push(day);
      }
    }

    return days.map((eventDate) => ({
      ...common,
      eventDate,
      startTime: "00:00",
      endTime: null,
      allDay: true,
    }));
  }

  if (!item.start?.dateTime) return [];

  const start = wardWallClock(new Date(item.start.dateTime));

  return [
    {
      ...common,
      eventDate: start.date,
      startTime: start.time,
      endTime: endTimeOf(start, item.end?.dateTime),
      allDay: false,
    },
  ];
}

/**
 * The end time, in the site's encoding: same day, or — for an event running
 * past midnight — a time earlier than the start.
 *
 * Anything that encoding cannot express (an event longer than a day, or one
 * ending exactly 24 hours later) drops the end time rather than lying about
 * it; the event still shows, on its start day, with a start time. That is an
 * accepted limitation for a ward calendar.
 */
function endTimeOf(
  start: { date: IsoDate; time: string },
  endDateTime: string | null | undefined,
): string | null {
  if (!endDateTime) return null;

  const end = wardWallClock(new Date(endDateTime));
  if (end.date === start.date) return end.time;
  if (end.date === addCalendarDays(start.date, 1) && end.time < start.time) {
    return end.time;
  }
  return null;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * Google lets a description carry HTML; the site renders descriptions as plain
 * text, so the markup comes out and the line breaks it stood for stay in.
 */
function toPlainText(html: string | null | undefined): string | null {
  if (!html) return null;

  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&nbsp;/g, (entity) => HTML_ENTITIES[entity])
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text || null;
}
