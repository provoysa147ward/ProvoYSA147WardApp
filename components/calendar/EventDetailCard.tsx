"use client";

import { useEffect, useRef } from "react";

import { formatDayLabel, formatTimeRange } from "@/lib/date";
import type { EventOccurrence } from "@/lib/events";

import { Button } from "@/components/ui/Button";

import { CategoryChip } from "./EventChip";
import type { CalendarSelection } from "./MonthGrid";

/**
 * The detail view for a tapped event, in a native `<dialog>` so focus trapping,
 * Escape-to-close, and the backdrop come from the platform.
 *
 * It never renders submitter name or contact — those columns are not even
 * present in the data reaching this component (see `events_public`), and this
 * comment is here so nobody adds them.
 */
export function EventDetailCard({
  selection,
  onClose,
}: {
  selection: CalendarSelection | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (selection && !dialog.open) dialog.showModal();
    if (!selection && dialog.open) dialog.close();
  }, [selection]);

  const multiple = (selection?.occurrences.length ?? 0) > 1;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        // A click landing on the dialog itself is a click on the backdrop:
        // the content sits inside the wrapper below.
        if (event.target === dialogRef.current) onClose();
      }}
      aria-labelledby="event-detail-heading"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      {selection ? (
        <div className="flex flex-col gap-4 p-5">
          <h2
            id="event-detail-heading"
            className="text-sm font-bold text-ink-muted"
          >
            <time dateTime={selection.date}>
              {formatDayLabel(selection.date)}
            </time>
          </h2>

          <ul className="flex flex-col gap-4">
            {selection.occurrences.map((occurrence) => (
              <li
                key={occurrence.key}
                className={
                  multiple ? "border-b border-line pb-4 last:border-0" : ""
                }
              >
                <EventDetails occurrence={occurrence} />
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose} autoFocus>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

function EventDetails({ occurrence }: { occurrence: EventOccurrence }) {
  const { event } = occurrence;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold">{event.title}</h3>
        <CategoryChip category={event.category} />
      </div>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-semibold text-ink-muted">Time</dt>
          <dd>{formatTimeRange(event.startTime, event.endTime)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-ink-muted">Where</dt>
          <dd>{event.location}</dd>
        </div>
        {event.repeatsWeekly ? (
          <div className="flex gap-2">
            <dt className="font-semibold text-ink-muted">Repeats</dt>
            <dd>
              Weekly
              {event.repeatUntil
                ? ` until ${formatDayLabel(event.repeatUntil, "MMMM d, yyyy")}`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {event.description ? (
        <p className="whitespace-pre-line text-sm text-ink-muted">
          {event.description}
        </p>
      ) : null}
    </div>
  );
}
