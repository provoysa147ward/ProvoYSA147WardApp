"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { retrySync } from "@/app/admin/(protected)/events/actions";
import {
  INITIAL_EVENT_ACTION_STATE,
  type EventActionState,
} from "@/app/admin/(protected)/events/action-state";
import { Button } from "@/components/ui/Button";

/**
 * Makes a sync failure visible and one click away from fixed.
 *
 * Shown only when something actually needs pushing, so an admin who never
 * touches Google never sees it — and when credentials land for the first time,
 * the same button pushes the whole backlog.
 */
export function SyncBanner({
  failedCount,
  notSyncedCount,
  syncEnabled,
}: {
  failedCount: number;
  notSyncedCount: number;
  syncEnabled: boolean;
}) {
  // The action takes no payload — it pushes whatever the database says is
  // outstanding — but the dispatcher still has to accept a FormData so it can
  // be used as a form action.
  const [state, action] = useActionState<EventActionState, FormData>(
    retrySync,
    INITIAL_EVENT_ACTION_STATE,
  );

  const outstanding = failedCount + notSyncedCount;
  if (outstanding === 0 && !state.message) return null;

  // Without credentials there is nothing to retry, and nothing is broken —
  // the site works fine, the events simply aren't on Google yet.
  if (!syncEnabled) {
    return (
      <aside className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
        <p>
          <strong className="font-semibold text-ink">
            Google Calendar isn&apos;t connected.
          </strong>{" "}
          {outstanding} approved{" "}
          {outstanding === 1 ? "event is" : "events are"} waiting to be sent.
          Nothing is broken — the site works either way. Connecting it is in
          docs/HANDOFF.md.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm ${
        failedCount > 0
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-muted"
      }`}
    >
      <p role={failedCount > 0 ? "alert" : undefined}>
        {failedCount > 0 ? (
          <>
            <strong className="font-semibold">
              {failedCount} {failedCount === 1 ? "event" : "events"}
            </strong>{" "}
            didn&apos;t reach Google Calendar.
          </>
        ) : (
          <>
            {notSyncedCount}{" "}
            {notSyncedCount === 1 ? "event is" : "events are"} waiting to be
            sent to Google Calendar.
          </>
        )}{" "}
        They&apos;re still on the ward site — only the Google copy is missing.
      </p>

      {state.message ? (
        <p role="status" className="font-semibold">
          {state.message}
        </p>
      ) : null}
      {state.formError ? (
        <p role="alert" className="font-semibold">
          {state.formError}
        </p>
      ) : null}

      <form action={action}>
        <RetryButton />
      </form>
    </aside>
  );
}

function RetryButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? "Sending…" : "Retry sync"}
    </Button>
  );
}
