"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createEvent,
  deleteEvent,
  updateEvent,
} from "@/app/admin/(protected)/events/actions";
import {
  INITIAL_EVENT_ACTION_STATE,
  type EventActionState,
} from "@/app/admin/(protected)/events/action-state";
import { EventFields } from "@/components/admin/EventFields";
import { CategoryChip } from "@/components/calendar/EventChip";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminEvent } from "@/lib/adminQueries";
import { isEventCategory } from "@/lib/categories";
import { formatDayLabel, formatTimeRange } from "@/lib/date";
import { expandEvent } from "@/lib/events";

export function EventManager({
  approved,
  rejected,
}: {
  approved: AdminEvent[];
  rejected: AdminEvent[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <CreateEventSection />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">
          On the calendar ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <EmptyState emoji="🗓️" title="No events on the calendar yet." />
        ) : (
          <ul className="flex flex-col gap-3">
            {approved.map((event) => (
              <li key={event.id}>
                <EditableEvent event={event} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {rejected.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight">
            Rejected ({rejected.length})
          </h2>
          <p className="text-sm text-ink-muted">
            Kept for the record. These appear nowhere public.
          </p>
          <ul className="flex flex-col gap-2">
            {rejected.map((event) => (
              <li
                key={event.id}
                className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-muted"
              >
                <span className="font-semibold text-ink">{event.title}</span> ·{" "}
                {formatDayLabel(event.eventDate)} · from {event.submitterName}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CreateEventSection() {
  const [state, action] = useActionState<EventActionState, FormData>(
    createEvent,
    INITIAL_EVENT_ACTION_STATE,
  );
  const [open, setOpen] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Add an event</h2>
        <Button variant="secondary" onClick={() => setOpen((was) => !was)}>
          {open ? "Cancel" : "New event"}
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        Events you add here go straight onto the calendar — they skip the queue.
      </p>

      {state.status === "success" ? (
        <p
          role="status"
          className="rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
        >
          {state.message}
        </p>
      ) : null}

      {open ? (
        <form
          action={action}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4"
        >
          {state.formError ? (
            <p
              role="alert"
              className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
            >
              {state.formError}
            </p>
          ) : null}

          <EventFields errors={state.errors} />
          <SaveButton label="Add to the calendar" />
        </form>
      ) : null}
    </section>
  );
}

function EditableEvent({ event }: { event: AdminEvent }) {
  const [updateState, updateAction] = useActionState<
    EventActionState,
    FormData
  >(updateEvent, INITIAL_EVENT_ACTION_STATE);
  const [deleteState, deleteAction] = useActionState<
    EventActionState,
    FormData
  >(deleteEvent, INITIAL_EVENT_ACTION_STATE);

  const formError = updateState.formError ?? deleteState.formError;

  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none p-4">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="font-semibold">{event.title}</span>
            {isEventCategory(event.category) ? (
              <CategoryChip category={event.category} />
            ) : null}
          </span>
          <span className="text-sm text-ink-muted">
            {formatDayLabel(event.eventDate)} ·{" "}
            {formatTimeRange(event.startTime, event.endTime)}
          </span>
        </span>
      </summary>

      <div className="border-t border-line p-4">
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
          >
            {formError}
          </p>
        ) : null}

        {updateState.status === "success" ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
          >
            {updateState.message}
          </p>
        ) : null}

        <form action={updateAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={event.id} />
          <EventFields event={event} errors={updateState.errors} />
          <SaveButton label="Save changes" />
        </form>

        {/* Outside the form above: ConfirmDialog renders its own <form>, and a
            form may not contain another. */}
        <div className="mt-3">
          <DeleteControl event={event} action={deleteAction} />
        </div>
      </div>
    </details>
  );
}

/**
 * Delete asks for confirmation, and for a series it says how many occurrences
 * are about to disappear — "delete this event" reads very differently when it
 * means twelve Tuesdays.
 */
function DeleteControl({
  event,
  action,
}: {
  event: AdminEvent;
  action: (formData: FormData) => void;
}) {
  const remaining = event.repeatsWeekly
    ? expandEvent(
        {
          id: event.id,
          title: event.title,
          category: "other",
          eventDate: event.eventDate,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          description: null,
          allDay: false,
          repeatsWeekly: true,
          repeatUntil: event.repeatUntil,
        },
        {
          from: event.eventDate,
          to: event.repeatUntil ?? event.eventDate,
        },
      ).length
    : 1;

  return (
    <ConfirmDialog
      trigger="Delete"
      title={`Delete "${event.title}"?`}
      confirmLabel="Delete it"
      body={
        remaining > 1 ? (
          <>
            This is a weekly series with <strong>{remaining} occurrences</strong>{" "}
            still on the calendar. Deleting removes all of them. This
            can&apos;t be undone.
          </>
        ) : (
          <>This removes it from the calendar. This can&apos;t be undone.</>
        )
      }
      action={action}
    >
      <input type="hidden" name="id" value={event.id} />
    </ConfirmDialog>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
