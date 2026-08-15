"use client";

import {
  formatDayLabel,
  formatTimeRange,
  toUtcIso,
  type IsoDate,
} from "@/lib/date";
import type { EventOccurrence } from "@/lib/events";

import { EmptyState } from "@/components/ui/EmptyState";

import { CategoryChip } from "./EventChip";
import { groupByDate, type CalendarSelection } from "./MonthGrid";

/**
 * The phone view: a chronological list grouped by day, rather than a grid
 * squeezed onto a narrow screen.
 */
export function AgendaList({
  occurrences,
  onSelect,
  today,
  emptyMessage = "Nothing scheduled yet.",
}: {
  occurrences: readonly EventOccurrence[];
  onSelect: (selection: CalendarSelection) => void;
  today: IsoDate;
  emptyMessage?: string;
}) {
  const byDate = groupByDate(occurrences);

  if (byDate.size === 0) {
    return <EmptyState emoji="🗓️" title={emptyMessage} />;
  }

  return (
    <ol className="flex flex-col gap-6">
      {[...byDate.entries()].map(([date, dayOccurrences]) => (
        <li key={date}>
          <h3 className="mb-2 text-sm font-bold text-ink-muted">
            <time dateTime={date}>{formatDayLabel(date)}</time>
            {date === today ? (
              <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                Today
              </span>
            ) : null}
          </h3>

          <ul className="flex flex-col gap-2">
            {dayOccurrences.map((occurrence) => (
              <li key={occurrence.key}>
                <button
                  type="button"
                  onClick={() => onSelect({ date, occurrences: [occurrence] })}
                  className="w-full cursor-pointer rounded-xl border border-line bg-surface p-3 text-left transition hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-ink">
                      {occurrence.event.title}
                    </p>
                    <CategoryChip category={occurrence.event.category} />
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    <time dateTime={toUtcIso(occurrence.start)}>
                      {formatTimeRange(
                        occurrence.event.startTime,
                        occurrence.event.endTime,
                        occurrence.event.allDay,
                      )}
                    </time>
                    {occurrence.event.location
                      ? ` · ${occurrence.event.location}`
                      : null}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
