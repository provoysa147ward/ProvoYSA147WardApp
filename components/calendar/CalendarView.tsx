"use client";

import { useMemo, useState } from "react";

import {
  addCalendarDays,
  formatMonthLabel,
  formatMonthParam,
  monthGridRange,
  shiftMonth,
  type IsoDate,
  type MonthKey,
} from "@/lib/date";
import { expandEvents, UPCOMING_HORIZON_DAYS, type WardEvent } from "@/lib/events";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import { AgendaList } from "./AgendaList";
import { EventDetailCard } from "./EventDetailCard";
import { MonthGrid, type CalendarSelection } from "./MonthGrid";

/**
 * Both views are always rendered and CSS decides which is visible, so the
 * grid/agenda switch is a pure media query at the breakpoint defined in
 * `globals.css` — there is no JS width check to get out of sync with it.
 *
 * Occurrences are expanded here rather than on the server because the stored
 * rows are the small, cacheable thing: one row for a whole weekly series.
 */
export function CalendarView({
  events,
  month,
  today,
}: {
  events: WardEvent[];
  month: MonthKey;
  today: IsoDate;
}) {
  const [selection, setSelection] = useState<CalendarSelection | null>(null);

  const monthOccurrences = useMemo(
    () => expandEvents(events, monthGridRange(month)),
    [events, month],
  );

  // The agenda runs forward from today rather than following the grid's month,
  // because on a phone "what's coming up" is the useful question.
  const agendaOccurrences = useMemo(
    () =>
      expandEvents(events, {
        from: today,
        to: addCalendarDays(today, UPCOMING_HORIZON_DAYS),
      }),
    [events, today],
  );

  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <ButtonLink
          href={`/calendar?month=${formatMonthParam(previous)}`}
          variant="secondary"
          aria-label={`Previous month, ${formatMonthLabel(previous)}`}
          scroll={false}
        >
          ←<span className="sr-only sm:not-sr-only">Previous</span>
        </ButtonLink>

        {/*
          The heading is the live region: month navigation is a normal
          navigation, so a screen reader should hear which month it landed on.
        */}
        <h2
          aria-live="polite"
          className="text-lg font-bold tracking-tight sm:text-xl"
        >
          {formatMonthLabel(month)}
        </h2>

        <ButtonLink
          href={`/calendar?month=${formatMonthParam(next)}`}
          variant="secondary"
          aria-label={`Next month, ${formatMonthLabel(next)}`}
          scroll={false}
        >
          <span className="sr-only sm:not-sr-only">Next</span>→
        </ButtonLink>
      </div>

      <div className="hidden md:block">
        {monthOccurrences.length === 0 ? (
          <EmptyState emoji="🗓️" title={`Nothing scheduled in ${formatMonthLabel(month)}.`}>
            Check another month, or suggest something.
          </EmptyState>
        ) : (
          <MonthGrid
            month={month}
            occurrences={monthOccurrences}
            onSelect={setSelection}
            today={today}
          />
        )}
      </div>

      <div className="md:hidden">
        <h3 className="sr-only">Upcoming events</h3>
        <AgendaList
          occurrences={agendaOccurrences}
          onSelect={setSelection}
          today={today}
        />
      </div>

      <EventDetailCard
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
