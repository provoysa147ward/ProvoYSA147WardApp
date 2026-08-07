import "server-only";

import { google } from "googleapis";

import {
  WARD_TIME_ZONE,
  addCalendarDays,
  endsNextDay,
  toUtcIso,
  wardInstant,
  type IsoDate,
  type IsoTime,
} from "@/lib/date";

import { DEFAULT_DURATION_MINUTES } from "./calendarLink";

/**
 * One-way push of approved events to the ward's Google Calendar.
 *
 * Two properties matter more than anything else here:
 *
 *  - **It is optional.** Sync is enabled only when all three credentials are
 *    present. Without them the site works completely; approvals just queue as
 *    `not_synced` until someone adds them and presses Retry. That is what keeps
 *    launch from blocking on access to a ward Google account.
 *  - **It never blocks an approval.** Every function here returns a result
 *    rather than throwing, so a Google outage can only ever set
 *    `sync_status = 'failed'`.
 */

export interface GoogleEventInput {
  /** The Supabase row id — the Google event id is derived from it. */
  id: string;
  title: string;
  location: string;
  description: string | null;
  eventDate: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime | null;
  repeatsWeekly: boolean;
  repeatUntil: IsoDate | null;
}

export type SyncResult =
  | { ok: true; googleEventId: string }
  | { ok: true; skipped: "disabled" }
  | { ok: false; error: string };

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

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

export function isSyncEnabled(): boolean {
  return credentials() !== null;
}

function client(creds: GoogleCredentials) {
  const auth = new google.auth.JWT({
    email: creds.clientEmail,
    key: creds.privateKey,
    scopes: [CALENDAR_SCOPE],
  });
  return google.calendar({ version: "v3", auth });
}

/**
 * A Google event id derived from the Supabase UUID.
 *
 * Google requires base32hex characters (`a-v` and `0-9`), and a UUID's hex
 * digits are a subset of that once the hyphens come out. The prefix has to obey
 * the same alphabet — "ysa147" would be rejected, because `y` is outside it.
 *
 * Deriving rather than storing means a retry after a failure targets the same
 * event, so a half-finished push can never produce a duplicate.
 */
const ID_PREFIX = "provo";

export function googleEventId(supabaseId: string): string {
  return `${ID_PREFIX}${supabaseId.replace(/-/g, "").toLowerCase()}`;
}

/**
 * RFC 5545 requires the UNTIL of an RRULE to be a UTC timestamp, not a local
 * date. Using the series' own start time keeps the final occurrence included.
 */
export function buildRecurrenceRule(
  startTime: IsoTime,
  repeatUntil: IsoDate,
): string {
  const untilInstant = wardInstant(repeatUntil, startTime);
  const until = toUtcIso(untilInstant)
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `RRULE:FREQ=WEEKLY;UNTIL=${until}`;
}

/** The Google event body. Times are local + an explicit zone, never UTC. */
export function buildEventBody(event: GoogleEventInput) {
  const endsOnNextDay = endsNextDay(event.startTime, event.endTime);
  const endDate = endsOnNextDay
    ? addCalendarDays(event.eventDate, 1)
    : event.eventDate;

  const start = `${event.eventDate}T${normalizeTime(event.startTime)}`;
  const end = event.endTime
    ? `${endDate}T${normalizeTime(event.endTime)}`
    : `${event.eventDate}T${addMinutes(event.startTime, DEFAULT_DURATION_MINUTES)}`;

  return {
    id: googleEventId(event.id),
    summary: event.title,
    location: event.location,
    description: event.description ?? undefined,
    start: { dateTime: start, timeZone: WARD_TIME_ZONE },
    end: { dateTime: end, timeZone: WARD_TIME_ZONE },
    ...(event.repeatsWeekly && event.repeatUntil
      ? { recurrence: [buildRecurrenceRule(event.startTime, event.repeatUntil)] }
      : {}),
  };
}

function normalizeTime(time: IsoTime): string {
  return time.length === 5 ? `${time}:00` : time;
}

function addMinutes(time: IsoTime, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

function describeError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Google Calendar did not respond.";
}

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "number" ? code : undefined;
  }
  return undefined;
}

/**
 * Create the event. A 409 Conflict means it is already there from an earlier
 * attempt, which is success — the whole point of deterministic ids.
 */
export async function pushEvent(event: GoogleEventInput): Promise<SyncResult> {
  const creds = credentials();
  if (!creds) return { ok: true, skipped: "disabled" };

  try {
    await client(creds).events.insert({
      calendarId: creds.calendarId,
      requestBody: buildEventBody(event),
    });
    return { ok: true, googleEventId: googleEventId(event.id) };
  } catch (error) {
    if (statusOf(error) === 409) {
      return { ok: true, googleEventId: googleEventId(event.id) };
    }
    return { ok: false, error: describeError(error) };
  }
}

/**
 * Update the event. A 404 or 410 means it isn't there (or was deleted from the
 * Google side), so this falls back to creating it rather than leaving the two
 * calendars out of step.
 */
export async function patchEvent(event: GoogleEventInput): Promise<SyncResult> {
  const creds = credentials();
  if (!creds) return { ok: true, skipped: "disabled" };

  try {
    await client(creds).events.patch({
      calendarId: creds.calendarId,
      eventId: googleEventId(event.id),
      requestBody: buildEventBody(event),
    });
    return { ok: true, googleEventId: googleEventId(event.id) };
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || status === 410) return pushEvent(event);
    return { ok: false, error: describeError(error) };
  }
}

/** Delete the event. Already-gone counts as done. */
export async function deleteEvent(supabaseId: string): Promise<SyncResult> {
  const creds = credentials();
  if (!creds) return { ok: true, skipped: "disabled" };

  try {
    await client(creds).events.delete({
      calendarId: creds.calendarId,
      eventId: googleEventId(supabaseId),
    });
    return { ok: true, googleEventId: googleEventId(supabaseId) };
  } catch (error) {
    const status = statusOf(error);
    if (status === 404 || status === 410) {
      return { ok: true, googleEventId: googleEventId(supabaseId) };
    }
    return { ok: false, error: describeError(error) };
  }
}
