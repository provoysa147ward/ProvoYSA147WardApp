"use client";

import {
  ALL_DAY_LABEL,
  formatTimeLabel,
  isInMonth,
  monthGridWeeks,
  parseIsoDate,
  type IsoDate,
  type MonthKey,
} from "@/lib/date";
import type { EventOccurrence } from "@/lib/events";

import { EventChip } from "./EventChip";

/** Beyond this many events in one day, the rest collapse into "+N more". */
export const MAX_CHIPS_PER_DAY = 3;

/** What the detail dialog is showing: one event, or a whole day's worth. */
export interface CalendarSelection {
  date: IsoDate;
  occurrences: EventOccurrence[];
}

const WEEKDAYS = [
  { short: "Sun", long: "Sunday" },
  { short: "Mon", long: "Monday" },
  { short: "Tue", long: "Tuesday" },
  { short: "Wed", long: "Wednesday" },
  { short: "Thu", long: "Thursday" },
  { short: "Fri", long: "Friday" },
  { short: "Sat", long: "Saturday" },
];

export function groupByDate(
  occurrences: readonly EventOccurrence[],
): Map<IsoDate, EventOccurrence[]> {
  const byDate = new Map<IsoDate, EventOccurrence[]>();
  for (const occurrence of occurrences) {
    const bucket = byDate.get(occurrence.date);
    if (bucket) bucket.push(occurrence);
    else byDate.set(occurrence.date, [occurrence]);
  }
  return byDate;
}

/**
 * The desktop month view.
 *
 * A real `<table>` rather than a div grid: the relationship between a date and
 * its weekday column is meaningful, and a table conveys it to assistive
 * technology without any ARIA of our own.
 */
export function MonthGrid({
  month,
  occurrences,
  onSelect,
  today,
}: {
  month: MonthKey;
  occurrences: readonly EventOccurrence[];
  onSelect: (selection: CalendarSelection) => void;
  today: IsoDate;
}) {
  const weeks = monthGridWeeks(month);
  const byDate = groupByDate(occurrences);

  return (
    <table className="w-full table-fixed border-collapse">
      <caption className="sr-only">
        Events by day. Select an event to see its details.
      </caption>
      <thead>
        <tr>
          {WEEKDAYS.map((day) => (
            <th
              key={day.short}
              scope="col"
              className="border border-line bg-surface p-2 text-xs font-semibold text-ink-muted"
            >
              <abbr title={day.long} className="no-underline">
                {day.short}
              </abbr>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((date) => (
              <DayCell
                key={date}
                date={date}
                month={month}
                today={today}
                occurrences={byDate.get(date) ?? []}
                onSelect={onSelect}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayCell({
  date,
  month,
  today,
  occurrences,
  onSelect,
}: {
  date: IsoDate;
  month: MonthKey;
  today: IsoDate;
  occurrences: EventOccurrence[];
  onSelect: (selection: CalendarSelection) => void;
}) {
  const inMonth = isInMonth(date, month);
  const isToday = date === today;
  const visible = occurrences.slice(0, MAX_CHIPS_PER_DAY);
  const overflow = occurrences.length - visible.length;

  return (
    <td
      className={`h-28 border border-line align-top ${
        inMonth ? "bg-surface" : "bg-cream"
      }`}
    >
      <div className="flex h-full flex-col gap-1 p-1">
        <p
          className={`px-0.5 text-xs font-semibold ${
            inMonth ? "text-ink" : "text-ink-muted/60"
          }`}
        >
          <time dateTime={date}>
            {isToday ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-cream">
                {parseIsoDate(date).day}
              </span>
            ) : (
              parseIsoDate(date).day
            )}
          </time>
          {isToday ? <span className="sr-only"> (today)</span> : null}
        </p>

        <ul className="flex flex-col gap-0.5">
          {visible.map((occurrence) => (
            <li key={occurrence.key}>
              <button
                type="button"
                onClick={() => onSelect({ date, occurrences: [occurrence] })}
                className="block w-full cursor-pointer"
              >
                <EventChip
                  category={occurrence.event.category}
                  title={occurrence.event.title}
                  timeLabel={
                    occurrence.event.allDay
                      ? ALL_DAY_LABEL
                      : formatTimeLabel(occurrence.event.startTime)
                  }
                />
              </button>
            </li>
          ))}
        </ul>

        {overflow > 0 ? (
          <button
            type="button"
            onClick={() => onSelect({ date, occurrences })}
            className="cursor-pointer px-0.5 text-left text-xs font-semibold text-ink-muted hover:text-accent"
          >
            +{overflow} more
          </button>
        ) : null}
      </div>
    </td>
  );
}
