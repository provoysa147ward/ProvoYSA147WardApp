/**
 * Date and time helpers, all anchored to the ward's local time zone.
 *
 * Pure module: no I/O, no Supabase, no React. Two rules keep this DST-safe:
 *
 *  1. Calendar arithmetic (`addCalendarDays`, `differenceInCalendarDays`) works
 *     on calendar dates in UTC, where days are always exactly 24 hours. It never
 *     touches wall-clock time, so a spring-forward day cannot shift a date.
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/** Whole calendar days from `earlier` to `later`; negative when reversed. */
export function differenceInCalendarDays(
  later: IsoDate,
  earlier: IsoDate,
): number {
  return Math.round((toUtcMidnight(later) - toUtcMidnight(earlier)) / MS_PER_DAY);
}

function toUtcMidnight(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date);
  return Date.UTC(year, month - 1, day);
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

/**
 * `"7:00 PM"`, `"7:00 PM – 9:00 PM"`, or `"9:00 PM – 12:30 AM (next day)"` for
 * an event that runs past midnight.
 */
export function formatTimeRange(start: IsoTime, end: IsoTime | null): string {
  if (!end) return formatTimeLabel(start);
  const range = `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
  return endsNextDay(start, end) ? `${range} (next day)` : range;
}
