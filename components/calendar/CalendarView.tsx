"use client";

import { useMemo, useState, useSyncExternalStore } from "react";

import {
  addCalendarDays,
  firstDayOfMonth,
  formatDayLabel,
  formatMonthLabel,
  formatMonthParam,
  formatWeekLabel,
  monthGridRange,
  shiftMonth,
  weekRange,
  type IsoDate,
  type MonthKey,
} from "@/lib/date";
import {
  expandEvents,
  UPCOMING_HORIZON_DAYS,
  type EventOccurrence,
  type WardEvent,
} from "@/lib/events";

import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

import { AgendaList } from "./AgendaList";
import { EventDetailCard } from "./EventDetailCard";
import { MonthGrid, type CalendarSelection } from "./MonthGrid";
import {
  isCalendarViewName,
  ViewSwitcher,
  type CalendarViewName,
} from "./ViewSwitcher";

/** Where a visitor's chosen view is remembered between visits. */
export const VIEW_STORAGE_KEY = "calendar-view";

/**
 * Matches `--breakpoint-md` in `app/globals.css`. It is duplicated here — and
 * only here — because the *first* choice of view has to be made in JS before
 * anything is rendered; every other width decision on the site is still pure
 * CSS.
 */
const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * The calendar, in whichever of its four views the visitor last chose.
 *
 * The remembered choice and the device width are browser-only facts, so they
 * are read through `useSyncExternalStore`: the server (and the hydrating
 * render) sees `null`, which renders the existing CSS dual layout — month grid
 * at md and up, agenda below — and that *is* the smart default, so there is
 * nothing for hydration to mismatch. React then re-renders with the resolved
 * view. Nothing ever changes the resolution afterwards, hence the no-op
 * subscribe: resizing the window on purpose does not overrule a choice.
 *
 * Occurrences are expanded here rather than on the server because the stored
 * rows are the small, cacheable thing: one row for a whole weekly series.
 */
export function CalendarView({
  events,
  month,
  today,
  hasMonthParam = false,
}: {
  events: WardEvent[];
  month: MonthKey;
  today: IsoDate;
  /** True when the URL carries `?month=`, which pins the view to Month. */
  hasMonthParam?: boolean;
}) {
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const [chosen, setChosen] = useState<CalendarViewName | null>(null);
  const [anchor, setAnchor] = useState<IsoDate>(() =>
    hasMonthParam ? firstDayOfMonth(month) : today,
  );

  const remembered = useSyncExternalStore(
    subscribeToNothing,
    readRememberedView,
    () => null,
  );

  // Order matters: a view chosen in this session wins, then an explicit
  // `?month=` link — someone followed it to see that month — and only then the
  // remembered preference or the device default behind it.
  const view: CalendarViewName | null =
    chosen ?? (hasMonthParam ? "month" : remembered);

  const monthOccurrences = useMemo(
    () => expandEvents(events, monthGridRange(month)),
    [events, month],
  );

  // The schedule runs forward from today rather than following the grid's
  // month, because "what's coming up" is the useful question.
  const scheduleOccurrences = useMemo(
    () =>
      expandEvents(events, {
        from: today,
        to: addCalendarDays(today, UPCOMING_HORIZON_DAYS),
      }),
    [events, today],
  );

  const dayOccurrences = useMemo(
    () => expandEvents(events, { from: anchor, to: anchor }),
    [events, anchor],
  );

  const week = useMemo(() => weekRange(anchor), [anchor]);
  const weekOccurrences = useMemo(
    () => expandEvents(events, week),
    [events, week],
  );

  function chooseView(next: CalendarViewName) {
    setChosen(next);
    // Private-mode browsers throw on write; remembering the choice is a
    // convenience, never a requirement.
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Ignored on purpose.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ViewSwitcher view={view} onChange={chooseView} />

      {view === null || view === "month" ? (
        <MonthNav month={month} />
      ) : view === "day" ? (
        <AnchorNav
          label={formatDayLabel(anchor)}
          resetLabel="Today"
          onPrevious={() => setAnchor(addCalendarDays(anchor, -1))}
          onReset={() => setAnchor(today)}
          onNext={() => setAnchor(addCalendarDays(anchor, 1))}
          unit="day"
        />
      ) : view === "week" ? (
        <AnchorNav
          label={formatWeekLabel(week)}
          resetLabel="This week"
          onPrevious={() => setAnchor(addCalendarDays(anchor, -7))}
          onReset={() => setAnchor(today)}
          onNext={() => setAnchor(addCalendarDays(anchor, 7))}
          unit="week"
        />
      ) : null}

      {view === null ? (
        <>
          <div className="hidden md:block">
            <MonthBody
              month={month}
              occurrences={monthOccurrences}
              onSelect={setSelection}
              today={today}
            />
          </div>

          <div className="md:hidden">
            <h3 className="sr-only">Upcoming events</h3>
            <AgendaList
              occurrences={scheduleOccurrences}
              onSelect={setSelection}
              today={today}
            />
          </div>
        </>
      ) : view === "month" ? (
        <MonthBody
          month={month}
          occurrences={monthOccurrences}
          onSelect={setSelection}
          today={today}
        />
      ) : (
        <AgendaList
          occurrences={
            view === "schedule"
              ? scheduleOccurrences
              : view === "day"
                ? dayOccurrences
                : weekOccurrences
          }
          onSelect={setSelection}
          today={today}
          emptyMessage={
            view === "schedule"
              ? "Nothing scheduled yet."
              : view === "day"
                ? `Nothing scheduled on ${formatDayLabel(anchor)}.`
                : "Nothing scheduled this week."
          }
        />
      )}

      <EventDetailCard
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}

/** The resolution never changes after mount, so there is nothing to listen to. */
function subscribeToNothing(): () => void {
  return () => {};
}

/**
 * The remembered view, falling back to the device default. Returns a plain
 * string, so `useSyncExternalStore`'s snapshot comparison is stable.
 */
function readRememberedView(): CalendarViewName {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  } catch {
    // Private-mode browsers throw on read as well as write.
  }

  // A stale value from an older release falls back to the device default.
  if (isCalendarViewName(stored)) return stored;
  return window.matchMedia(DESKTOP_QUERY).matches ? "month" : "schedule";
}

function MonthBody({
  month,
  occurrences,
  onSelect,
  today,
}: {
  month: MonthKey;
  occurrences: EventOccurrence[];
  onSelect: (selection: CalendarSelection) => void;
  today: IsoDate;
}) {
  if (occurrences.length === 0) {
    return (
      <EmptyState
        emoji="🗓️"
        title={`Nothing scheduled in ${formatMonthLabel(month)}.`}
      >
        Check another month.
      </EmptyState>
    );
  }

  return (
    <MonthGrid
      month={month}
      occurrences={occurrences}
      onSelect={onSelect}
      today={today}
    />
  );
}

/**
 * Month navigation stays real links: `?month=` is the one calendar position
 * worth sharing, and it already works without JavaScript.
 */
function MonthNav({ month }: { month: MonthKey }) {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  return (
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
      <PeriodHeading>{formatMonthLabel(month)}</PeriodHeading>

      <ButtonLink
        href={`/calendar?month=${formatMonthParam(next)}`}
        variant="secondary"
        aria-label={`Next month, ${formatMonthLabel(next)}`}
        scroll={false}
      >
        <span className="sr-only sm:not-sr-only">Next</span>→
      </ButtonLink>
    </div>
  );
}

/**
 * Day and week navigation, which — unlike months — moves client state only.
 * A refresh returns to today; the anchor is not worth a URL.
 */
function AnchorNav({
  label,
  resetLabel,
  unit,
  onPrevious,
  onReset,
  onNext,
}: {
  label: string;
  resetLabel: string;
  unit: "day" | "week";
  onPrevious: () => void;
  onReset: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="secondary"
        aria-label={`Previous ${unit}`}
        onClick={onPrevious}
      >
        ←<span className="sr-only sm:not-sr-only">Previous</span>
      </Button>

      <div className="flex flex-col items-center gap-1">
        <PeriodHeading>{label}</PeriodHeading>
        <Button variant="quiet" onClick={onReset}>
          {resetLabel}
        </Button>
      </div>

      <Button variant="secondary" aria-label={`Next ${unit}`} onClick={onNext}>
        <span className="sr-only sm:not-sr-only">Next</span>→
      </Button>
    </div>
  );
}

function PeriodHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 aria-live="polite" className="text-lg font-bold tracking-tight sm:text-xl">
      {children}
    </h2>
  );
}
