/**
 * Date and time helpers, all anchored to the ward's local time zone.
 *
 * Pure module: no I/O, no Supabase, no React. Two rules keep this DST-safe:
 *
 *  1. Calendar arithmetic (`addCalendarDays`, `weekRange`) works on calendar
 *     dates in UTC, where days are always exactly 24 hours. It never touches
 *     wall-clock time, so a spring-forward day cannot shift a date.
 *  2. A wall-clock time is attached to a calendar date only at the very end, via
 *     `wardInstant`, which resolves the offset for that specific date. Adding
 *     7 × 24h to an instant would drift by an hour across a DST boundary;
 *     iterating dates and re-resolving the offset each time cannot.
 */

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const WARD_TIME_ZONE = "America/Denver";

/** A calendar date in `YYYY-MM-DD` form, matching Postgres `date`. */
export type IsoDate = string;

/** A wall-clock time in `HH:MM` or `HH:MM:SS` form, matching Postgres `time`. */
export type IsoTime = string;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

export interface CalendarDate {
  year: number;
  /** 1-12, unlike `Date`'s 0-11. */
  month: number;
  day: number;
}

export interface WallClockTime {
  hours: number;
  minutes: number;
  seconds: number;
}

export function parseIsoDate(date: IsoDate): CalendarDate {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) {
    throw new TypeError(`Expected a YYYY-MM-DD date, received "${date}"`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function parseIsoTime(time: IsoTime): WallClockTime {
  const match = ISO_TIME_PATTERN.exec(time);
  if (!match) {
    throw new TypeError(`Expected an HH:MM time, received "${time}"`);
  }
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: match[3] ? Number(match[3]) : 0,
  };
}

export function toIsoDate({ year, month, day }: CalendarDate): IsoDate {
  const pad = (value: number, width = 2) =>
    String(value).padStart(width, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * The instant at which `time` is read on the wall clock on `date` in the ward's
 * time zone. The returned value is a real `Date` (a `TZDate`), so comparisons
 * against `Date.now()` are exact.
 */
export function wardInstant(date: IsoDate, time: IsoTime): TZDate {
  const { year, month, day } = parseIsoDate(date);
  const { hours, minutes, seconds } = parseIsoTime(time);
  return new TZDate(
    year,
    month - 1,
    day,
    hours,
    minutes,
    seconds,
    0,
    WARD_TIME_ZONE,
  );
}

/**
 * The UTC instant as a `Z`-suffixed ISO string.
 *
 * `TZDate.prototype.toISOString()` returns the ward-zone offset form
 * (`2026-03-01T19:00:00.000-07:00`) — valid ISO 8601, but not what a caller
 * asking for UTC expects. This normalises back to plain `Date` behaviour.
 */
export function toUtcIso(instant: Date): string {
  return new Date(instant.getTime()).toISOString();
}

/** Adds whole calendar days. See the module note on why this runs in UTC. */
export function addCalendarDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return toIsoDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/**
 * Today's calendar date in the ward's time zone, regardless of where the server
 * or the visitor's browser happens to be.
 */
export function wardToday(now: Date = new Date()): IsoDate {
  const local = new TZDate(now.getTime(), WARD_TIME_ZONE);
  return toIsoDate({
    year: local.getFullYear(),
    month: local.getMonth() + 1,
    day: local.getDate(),
  });
}

/**
 * An instant read off the ward's wall clock: the calendar date it falls on
 * there, and the time it shows. This is how a Google `dateTime` — which
 * carries whatever offset the event was created in — becomes a ward date and
 * time, correctly on either side of a DST boundary.
 */
export function wardWallClock(instant: Date): { date: IsoDate; time: IsoTime } {
  const local = new TZDate(instant.getTime(), WARD_TIME_ZONE);
  return {
    date: toIsoDate({
      year: local.getFullYear(),
      month: local.getMonth() + 1,
      day: local.getDate(),
    }),
    time: `${String(local.getHours()).padStart(2, "0")}:${String(
      local.getMinutes(),
    ).padStart(2, "0")}`,
  };
}

/**
 * True when an event runs past midnight — the schema encodes that as an end
 * time earlier than the start time. An end time equal to the start is a
 * zero-length event on the same day, not a 24-hour one.
 */
export function endsNextDay(start: IsoTime, end: IsoTime | null): boolean {
  if (!end) return false;
  return toMinutesOfDay(end) < toMinutesOfDay(start);
}

function toMinutesOfDay(time: IsoTime): number {
  const { hours, minutes } = parseIsoTime(time);
  return hours * 60 + minutes;
}

/** `"19:30"` -> `"7:30 PM"`. */
export function formatTimeLabel(time: IsoTime): string {
  const { hours, minutes } = parseIsoTime(time);
  const period = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * `"2026-08-08"` -> `"Saturday, August 8"`.
 *
 * A calendar date carries no time zone, so this formats it in the system zone
 * at noon: constructing and reading the components back is an exact round-trip,
 * and noon avoids zones where local midnight does not exist on a DST day.
 */
export function formatDayLabel(date: IsoDate, pattern = "EEEE, MMMM d"): string {
  const { year, month, day } = parseIsoDate(date);
  return format(new Date(year, month - 1, day, 12), pattern);
}

export const ALL_DAY_LABEL = "All day";

/**
 * `"7:00 PM"`, `"7:00 PM – 9:00 PM"`, or `"9:00 PM – 12:30 AM (next day)"` for
 * an event that runs past midnight. An all-day event has no meaningful clock
 * time, so it says so instead.
 */
export function formatTimeRange(
  start: IsoTime,
  end: IsoTime | null,
  allDay = false,
): string {
  if (allDay) return ALL_DAY_LABEL;
  if (!end) return formatTimeLabel(start);
  const range = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  return endsNextDay(start, end) ? `${range} (next day)` : range;
}

// ---------------------------------------------------------------------------
// Weeks
// ---------------------------------------------------------------------------

/**
 * The Sunday-to-Saturday week containing `date`, inclusive at both ends —
 * the same week boundary the month grid's columns use.
 */
export function weekRange(date: IsoDate): { from: IsoDate; to: IsoDate } {
  const from = addCalendarDays(date, -weekdayOf(date));
  return { from, to: addCalendarDays(from, 6) };
}

/**
 * `"Aug 16 – 22, 2026"`, collapsing whatever the two ends share: a week that
 * straddles a month prints `"Aug 30 – Sep 5, 2026"`, and one that straddles a
 * year prints both years.
 */
export function formatWeekLabel({
  from,
  to,
}: {
  from: IsoDate;
  to: IsoDate;
}): string {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);

  if (start.year !== end.year) {
    return `${formatDayLabel(from, "MMM d, yyyy")} – ${formatDayLabel(to, "MMM d, yyyy")}`;
  }
  if (start.month !== end.month) {
    return `${formatDayLabel(from, "MMM d")} – ${formatDayLabel(to, "MMM d, yyyy")}`;
  }
  return `${formatDayLabel(from, "MMM d")} – ${formatDayLabel(to, "d, yyyy")}`;
}

// ---------------------------------------------------------------------------
// Month grid
// ---------------------------------------------------------------------------

/** A calendar month. `month` is 1-12. */
export interface MonthKey {
  year: number;
  month: number;
}

const MONTH_PARAM_PATTERN = /^(\d{4})-(\d{2})$/;

export function monthOf(date: IsoDate): MonthKey {
  const { year, month } = parseIsoDate(date);
  return { year, month };
}

/** `"2026-08"`, the form used in the calendar's `?month=` parameter. */
export function formatMonthParam({ year, month }: MonthKey): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** Parses `?month=`, falling back to `fallback` for anything malformed. */
export function parseMonthParam(
  value: string | undefined,
  fallback: MonthKey,
): MonthKey {
  const match = MONTH_PARAM_PATTERN.exec(value ?? "");
  if (!match) return fallback;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return fallback;

  return { year, month };
}

export function shiftMonth({ year, month }: MonthKey, delta: number): MonthKey {
  const zeroBased = month - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

/** `"August 2026"`. */
export function formatMonthLabel(key: MonthKey): string {
  return formatDayLabel(firstDayOfMonth(key), "MMMM yyyy");
}

export function firstDayOfMonth({ year, month }: MonthKey): IsoDate {
  return toIsoDate({ year, month, day: 1 });
}

export function daysInMonth({ year, month }: MonthKey): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday, matching the grid's first column. */
export function weekdayOf(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * The month laid out as whole Sunday-to-Saturday weeks, including the leading
 * and trailing days from the neighbouring months that fill the first and last
 * rows. Only as many rows as the month actually needs.
 */
export function monthGridWeeks(key: MonthKey): IsoDate[][] {
  const first = firstDayOfMonth(key);
  const leading = weekdayOf(first);
  const weeks = Math.ceil((leading + daysInMonth(key)) / 7);
  const gridStart = addCalendarDays(first, -leading);

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) =>
      addCalendarDays(gridStart, week * 7 + day),
    ),
  );
}

/** The inclusive date range the grid covers, for expanding occurrences. */
export function monthGridRange(key: MonthKey): { from: IsoDate; to: IsoDate } {
  const weeks = monthGridWeeks(key);
  return { from: weeks[0][0], to: weeks[weeks.length - 1][6] };
}

export function isInMonth(date: IsoDate, key: MonthKey): boolean {
  const { year, month } = parseIsoDate(date);
  return year === key.year && month === key.month;
}
