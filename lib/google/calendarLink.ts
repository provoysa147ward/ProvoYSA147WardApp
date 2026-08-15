import {
  WARD_TIME_ZONE,
  addCalendarDays,
  endsNextDay,
  toUtcIso,
  wardInstant,
  type IsoDate,
  type IsoTime,
} from "@/lib/date";

/**
 * "Add to Google Calendar" template links.
 *
 * Deliberately separate from `lib/google/calendar.ts`: that module is
 * `server-only` and pulls in googleapis, while this is a pure string builder
 * the event detail card renders in the browser. It is also independent of
 * whether the ward's own calendar push is configured, so it works from day one.
 */

/** Length assumed for an event with no stated end time. */
export const DEFAULT_DURATION_MINUTES = 120;

/** Google's template URL wants a compact UTC timestamp: 20260810T010000Z. */
function compact(instant: Date): string {
  return toUtcIso(instant).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** An all-day range is dates only: 20260810. */
function compactDate(date: IsoDate): string {
  return date.replace(/-/g, "");
}

export function addToGoogleCalendarUrl(event: {
  title: string;
  location: string;
  description: string | null;
  date: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime | null;
  allDay?: boolean;
}): string {
  const start = wardInstant(event.date, event.startTime);
  const endsOnNextDay = endsNextDay(event.startTime, event.endTime);
  const end = event.endTime
    ? wardInstant(
        endsOnNextDay ? addCalendarDays(event.date, 1) : event.date,
        event.endTime,
      )
    : new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);

  // An all-day event is a date range in Google's template, not an instant
  // range — and its end date is exclusive, the same as the API's.
  const dates = event.allDay
    ? `${compactDate(event.date)}/${compactDate(addCalendarDays(event.date, 1))}`
    : `${compact(start)}/${compact(end)}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    location: event.location,
    ctz: WARD_TIME_ZONE,
  });
  if (event.description) params.set("details", event.description);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
