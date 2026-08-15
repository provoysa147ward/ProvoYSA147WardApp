/**
 * Occurrence expansion for ward events.
 *
 * A weekly series is stored as a single row and expanded at read time, so an
 * edit to the series touches one row and one Google Calendar patch. Expansion
 * walks calendar dates and re-resolves the ward's UTC offset for each one (see
 * `lib/date.ts`), which is what makes a 7 PM series stay at 7 PM across a DST
 * boundary.
 *
 * Pure module: no I/O, no Supabase, no React.
 */

import type { EventCategory } from "./categories";
import {
  addCalendarDays,
  differenceInCalendarDays,
  endsNextDay,
  wardInstant,
  wardToday,
  type IsoDate,
  type IsoTime,
} from "./date";

export interface WardEvent {
  id: string;
  title: string;
  category: EventCategory;
  eventDate: IsoDate;
  startTime: IsoTime;
  /** Null when the submitter left it blank; earlier than start means past midnight. */
  endTime: IsoTime | null;
  location: string;
  description: string | null;
  /**
   * An all-day event. It still carries a start time of `"00:00"` so the
   * occurrence maths needs no special case; only the label changes.
   */
  allDay: boolean;
  repeatsWeekly: boolean;
  /** Inclusive last date of a weekly series. Required whenever `repeatsWeekly`. */
  repeatUntil: IsoDate | null;
}

export interface EventOccurrence {
  /** Stable identity for one occurrence of a possibly-recurring event. */
  key: string;
  event: WardEvent;
  date: IsoDate;
  start: Date;
  /**
   * When the occurrence stops counting as upcoming. An event with no end time
   * runs until the end of its day rather than disappearing the moment it starts.
   */
  end: Date;
  endsNextDay: boolean;
}

export interface DateRange {
  /** Inclusive. */
  from: IsoDate;
  /** Inclusive. */
  to: IsoDate;
}

/** Weekly series are capped at one year by validation; the horizon mirrors that. */
export const UPCOMING_HORIZON_DAYS = 366;

const DAYS_PER_WEEK = 7;

/**
 * Every occurrence of `event` whose date falls inside `range`, in date order.
 *
 * The range is always the outer bound, so a series whose `repeatUntil` is
 * missing — which validation rejects, but bad data should not hang a page —
 * still terminates.
 */
export function expandEvent(
  event: WardEvent,
  range: DateRange,
): EventOccurrence[] {
  if (range.to < range.from) return [];

  if (!event.repeatsWeekly) {
    const inRange =
      event.eventDate >= range.from && event.eventDate <= range.to;
    return inRange ? [occurrenceOn(event, event.eventDate)] : [];
  }

  const lastDate =
    event.repeatUntil && event.repeatUntil < range.to
      ? event.repeatUntil
      : range.to;

  // Jump straight to the first occurrence inside the range instead of walking
  // every week since the series began.
  const weeksToSkip = Math.max(
    0,
    Math.ceil(
      differenceInCalendarDays(range.from, event.eventDate) / DAYS_PER_WEEK,
    ),
  );

  const occurrences: EventOccurrence[] = [];
  let date = addCalendarDays(event.eventDate, weeksToSkip * DAYS_PER_WEEK);
  while (date <= lastDate) {
    occurrences.push(occurrenceOn(event, date));
    date = addCalendarDays(date, DAYS_PER_WEEK);
  }
  return occurrences;
}

/** Every occurrence of every event inside `range`, in chronological order. */
export function expandEvents(
  events: readonly WardEvent[],
  range: DateRange,
): EventOccurrence[] {
  return events
    .flatMap((event) => expandEvent(event, range))
    .sort(compareOccurrences);
}

export interface UpcomingOptions {
  now?: Date;
  limit?: number;
}

/**
 * Occurrences that have not finished yet, soonest first. An event already in
 * progress still counts as upcoming until its end time.
 */
export function upcomingOccurrences(
  events: readonly WardEvent[],
  { now = new Date(), limit }: UpcomingOptions = {},
): EventOccurrence[] {
  const today = wardToday(now);
  // Reach back one day so an event that started yesterday and runs past
  // midnight is still considered; the end-time filter below is what actually
  // decides whether it counts as upcoming.
  const range = {
    from: addCalendarDays(today, -1),
    to: addCalendarDays(today, UPCOMING_HORIZON_DAYS),
  };
  const cutoff = now.getTime();

  const upcoming = expandEvents(events, range).filter(
    (occurrence) => occurrence.end.getTime() > cutoff,
  );

  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

function occurrenceOn(event: WardEvent, date: IsoDate): EventOccurrence {
  const spillsOver = endsNextDay(event.startTime, event.endTime);
  const nextDay = addCalendarDays(date, 1);

  return {
    key: `${event.id}@${date}`,
    event,
    date,
    start: wardInstant(date, event.startTime),
    end: event.endTime
      ? wardInstant(spillsOver ? nextDay : date, event.endTime)
      : wardInstant(nextDay, "00:00"),
    endsNextDay: spillsOver,
  };
}

/** Chronological, with title then id breaking ties so ordering is stable. */
function compareOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  return (
    a.start.getTime() - b.start.getTime() ||
    a.event.title.localeCompare(b.event.title) ||
    a.event.id.localeCompare(b.event.id)
  );
}
