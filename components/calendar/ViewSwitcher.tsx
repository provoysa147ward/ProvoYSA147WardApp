"use client";

/**
 * The Schedule / Day / Week / Month segmented control.
 *
 * Plain `<button>`s inside a labelled `role="group"` rather than a tablist or
 * radiogroup: `aria-pressed` already says which one is active, and buttons need
 * no custom arrow-key handling to behave the way people expect. That matches
 * the rest of the site's minimal-ARIA style.
 */

export const CALENDAR_VIEWS = ["schedule", "day", "week", "month"] as const;

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number];

const VIEW_LABELS: Record<CalendarViewName, string> = {
  schedule: "Schedule",
  day: "Day",
  week: "Week",
  month: "Month",
};

export function isCalendarViewName(value: unknown): value is CalendarViewName {
  return (
    typeof value === "string" &&
    (CALENDAR_VIEWS as readonly string[]).includes(value)
  );
}

export function ViewSwitcher({
  view,
  onChange,
}: {
  /** Null before the remembered or device-default view has been resolved. */
  view: CalendarViewName | null;
  onChange: (view: CalendarViewName) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar view"
      className="flex flex-wrap gap-1 self-start rounded-full border border-line bg-surface p-1"
    >
      {CALENDAR_VIEWS.map((value) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-semibold transition ${
              active
                ? "bg-accent text-cream"
                : "text-ink-muted hover:text-accent"
            }`}
          >
            {VIEW_LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
