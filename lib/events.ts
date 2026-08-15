/**
 * Occurrences of ward events.
 *
 * Google expands recurrence for us (`singleEvents: true`), so one event is one
 * date and this module only has to select and order. What it still owns is the
 * resolved instants: a wall-clock time is attached to a calendar date by
 * `lib/date.ts`, which re-resolves the ward's UTC offset for that date, so a
 * 7 PM event is 7 PM on either side of a DST boundary.
 *
 * Pure module: no I/O, no Supabase, no React.
 */

import type { EventCategory } from "./categories";
import {
  addCalendarDays,
  endsNextDay,
  wardInstant,
  wardToday,
  type IsoDate,
  type IsoTime,
} from "./date";

export interface WardEvent {
  /**
   * The Google instance id. Not unique across a list: an all-day event
   * covering several days is one `WardEvent` per day, all sharing it. The
   * occurrence key is the unique handle.
   */
  id: string;
  title: string;
  category: EventCategory;
  eventDate: IsoDate;
  startTime: IsoTime;
  /** Null when the event has no end; earlier than start means past midnight. */
  endTime: IsoTime | null;
  location: string;
  description: string | null;
  /**
   * An all-day event. It still carries a start time of `"00:00"` so the
   * occurrence maths needs no special case; only the label changes.
   */
  allDay: boolean;
}

export interface EventOccurrence {
  /** Stable identity for one occurrence, unique within a list. */
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
  /** Inclusive. Omitted means everything from `from` onwards. */
  to?: IsoDate;
}

/** Every occurrence inside `range`, in chronological order. */
export function occurrencesInRange(
  events: readonly WardEvent[],
  range: DateRange,
): EventOccurrence[] {
  if (range.to !== undefined && range.to < range.from) return [];

  return events
    .filter(
      (event) =>
        event.eventDate >= range.from &&
        (range.to === undefined || event.eventDate <= range.to),
    )
    .map(occurrenceOn)
    .sort(compareOccurrences);
}

export interface UpcomingOptions {
  now?: Date;
  limit?: number;
  /**
   * Look no further ahead than this many days from today, inclusive. Omitted
   * means everything the caller was given.
   */
  withinDays?: number;
}

/**
 * Occurrences that have not finished yet, soonest first. An event already in
 * progress still counts as upcoming until its end time.
 */
export function upcomingOccurrences(
  events: readonly WardEvent[],
  { now = new Date(), limit, withinDays }: UpcomingOptions = {},
): EventOccurrence[] {
  const today = wardToday(now);
  // Reach back one day so an event that started yesterday and runs past
  // midnight is still considered; the end-time filter below is what actually
  // decides whether it counts as upcoming.
  const from = addCalendarDays(today, -1);
  const to =
    withinDays === undefined ? undefined : addCalendarDays(today, withinDays);
  const cutoff = now.getTime();

  const upcoming = occurrencesInRange(events, { from, to }).filter(
    (occurrence) => occurrence.end.getTime() > cutoff,
  );

  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

function occurrenceOn(event: WardEvent): EventOccurrence {
  const { eventDate: date } = event;
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
