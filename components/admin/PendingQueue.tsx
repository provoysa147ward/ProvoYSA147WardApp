"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  approveEvent,
  rejectEvent,
} from "@/app/admin/(protected)/events/actions";
import {
  INITIAL_EVENT_ACTION_STATE,
  type EventActionState,
} from "@/app/admin/(protected)/events/action-state";
import { EventFields } from "@/components/admin/EventFields";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminEvent } from "@/lib/adminQueries";
import { formatDayLabel, formatTimeRange } from "@/lib/date";

export function PendingQueue({ events }: { events: AdminEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState emoji="✅" title="Nothing waiting.">
        New suggestions land here for review.
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {events.map((event) => (
        <li key={event.id}>
          <PendingItem event={event} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One queued suggestion, opening into an editable form.
 *
 * Approve saves the admin's edits and approves in the same statement, so there
 * is never a moment where an edited-but-unapproved version is live.
 */
function PendingItem({ event }: { event: AdminEvent }) {
  const [approveState, approveAction] = useActionState<
    EventActionState,
    FormData
  >(approveEvent, INITIAL_EVENT_ACTION_STATE);
  const [rejectState, rejectAction] = useActionState<
    EventActionState,
    FormData
  >(rejectEvent, INITIAL_EVENT_ACTION_STATE);

  const formError = approveState.formError ?? rejectState.formError;

  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none p-4">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{event.title}</span>
          <span className="text-sm text-ink-muted">
            {formatDayLabel(event.eventDate)} ·{" "}
            {formatTimeRange(event.startTime, event.endTime)}
          </span>
        </span>
        <span className="mt-1 block text-sm text-ink-muted">
          {event.location} · from {event.submitterName} ({event.submitterContact})
        </span>
      </summary>

      <div className="border-t border-line p-4">
        {formError ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
          >
            {formError}
          </p>
        ) : null}

        <form action={approveAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={event.id} />
          <EventFields event={event} errors={approveState.errors} />

          <div className="flex flex-wrap gap-2">
            <ApproveButton />
          </div>
        </form>

        <form action={rejectAction} className="mt-3">
          <input type="hidden" name="id" value={event.id} />
          <RejectButton />
          <p className="mt-1 text-xs text-ink-muted">
            Rejecting hides it everywhere but keeps the record, so the same
            suggestion doesn&apos;t come back around.
          </p>
        </form>
      </div>
    </details>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Approving…" : "Save and approve"}
    </Button>
  );
}

function RejectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Rejecting…" : "Reject"}
    </Button>
  );
}
