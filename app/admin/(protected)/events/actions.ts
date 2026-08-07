"use server";

import { revalidatePath } from "next/cache";

import {
  deleteEvent as deleteGoogleEvent,
  isSyncEnabled,
  patchEvent,
  pushEvent,
  type GoogleEventInput,
  type SyncResult,
} from "@/lib/google/calendar";
import {
  NotAdminError,
  NotAuthenticatedError,
  createClient,
  requireAdmin,
} from "@/lib/supabase/server";
import {
  adminEventSchema,
  toEventRow,
  type AdminEventInput,
} from "@/lib/validation/adminEvent";

import type { EventActionState } from "./action-state";

/** Maps a validated event onto what the Google push needs. */
function toGoogleInput(id: string, event: AdminEventInput): GoogleEventInput {
  return {
    id,
    title: event.title,
    location: event.location,
    description: event.description,
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    repeatsWeekly: event.repeatsWeekly,
    repeatUntil: event.repeatUntil,
  };
}

/**
 * Record the outcome of a push without ever failing the operation that
 * triggered it. The event is already approved by the time this runs; a Google
 * outage must not undo that, so the worst case is a `failed` badge and a Retry
 * button.
 */
async function recordSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  result: SyncResult,
): Promise<void> {
  const patch = result.ok
    ? "skipped" in result
      ? { sync_status: "not_synced" as const }
      : { sync_status: "synced" as const, google_event_id: result.googleEventId }
    : { sync_status: "failed" as const };

  await supabase.from("events").update(patch).eq("id", id);
}

/**
 * Every write an admin can make to an event.
 *
 * Each one calls `requireAdmin()` first. A server action is an independently
 * invocable POST endpoint — the fact that only an admin can *see* the form
 * that posts to it guarantees nothing about who can post to it. RLS would
 * still refuse, but failing here gives a real message instead of a raw
 * database error.
 */

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Turns the guard's errors into something an admin can act on. */
function guardMessage(error: unknown): string {
  if (error instanceof NotAdminError) {
    return "Your admin access was removed. Sign in again to check.";
  }
  if (error instanceof NotAuthenticatedError) {
    return "You've been signed out. Sign in again to continue.";
  }
  return "Something went wrong. Try again in a moment.";
}

function readEventForm(formData: FormData) {
  return {
    title: formData.get("title") ?? "",
    category: formData.get("category") ?? "",
    eventDate: formData.get("eventDate") ?? "",
    startTime: formData.get("startTime") ?? "",
    endTime: formData.get("endTime") ?? "",
    location: formData.get("location") ?? "",
    description: formData.get("description") ?? "",
    repeatsWeekly: formData.get("repeatsWeekly") === "on",
    repeatUntil: formData.get("repeatUntil") ?? "",
    submitterName: formData.get("submitterName") ?? "",
    submitterContact: formData.get("submitterContact") ?? "",
  };
}

function revalidateEverywhere() {
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/admin");
  revalidatePath("/admin/events");
}

/**
 * Save the admin's edits and approve, in one statement.
 *
 * The `.eq("status", "pending")` is the whole concurrency story: two admins
 * clicking Approve at the same moment both run this update, but only one can
 * match a row that is still pending. The loser changes nothing and is told so,
 * which is what stops Phase 8 pushing the same event to Google twice.
 */
export async function approveEvent(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", errors: {}, formError: "Missing event id." };
  }

  const parsed = adminEventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ ...toEventRow(parsed.data), status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not approve that: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      errors: {},
      formError:
        "That event isn't pending any more — someone else may have just handled it.",
    };
  }

  // Only the winning transition reaches here, so a double-click cannot push
  // the same event to Google twice.
  await recordSync(
    supabase,
    id,
    await pushEvent(toGoogleInput(id, parsed.data)),
  );

  revalidateEverywhere();
  return {
    status: "success",
    errors: {},
    message: isSyncEnabled() ? "Approved and sent to Google." : "Approved.",
  };
}

/**
 * Reject by status, never by deletion: the row stays so the same suggestion
 * doesn't get re-litigated, and the submitter's details survive if someone
 * needs to explain the decision.
 */
export async function rejectEvent(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not reject that: ${error.message}`,
    };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      errors: {},
      formError: "That event isn't pending any more.",
    };
  }

  revalidateEverywhere();
  return { status: "success", errors: {}, message: "Rejected." };
}

/** Admin-created events skip the queue: an admin approving themselves is a no-op. */
export async function createEvent(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const raw = readEventForm(formData);
  // An admin filling in their own event shouldn't have to type their address.
  if (!raw.submitterName) raw.submitterName = "Ward admin";
  if (!raw.submitterContact) raw.submitterContact = admin.email;

  const parsed = adminEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({ ...toEventRow(parsed.data), status: "approved" })
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      errors: {},
      formError: `Could not create that: ${error?.message}`,
    };
  }

  await recordSync(
    supabase,
    data.id,
    await pushEvent(toGoogleInput(data.id, parsed.data)),
  );

  revalidateEverywhere();
  return { status: "success", errors: {}, message: "Event created." };
}

export async function updateEvent(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { status: "error", errors: {}, formError: "Missing event id." };
  }

  const parsed = adminEventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("events")
    .select("status, sync_status")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("events")
    .update(toEventRow(parsed.data))
    .eq("id", id);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not save that: ${error.message}`,
    };
  }

  // Only approved events exist on the ward calendar, so only those propagate.
  if (before?.status === "approved") {
    await recordSync(
      supabase,
      id,
      await patchEvent(toGoogleInput(id, parsed.data)),
    );
  }

  revalidateEverywhere();
  return { status: "success", errors: {}, message: "Saved." };
}

export async function deleteEvent(
  _previous: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();

  const { data: before } = await supabase
    .from("events")
    .select("status, sync_status")
    .eq("id", id)
    .maybeSingle();

  // Google first: once the row is gone there is nothing left to retry from.
  // A failure here still lets the delete proceed, and the ward calendar keeps
  // a stale entry the admin can remove by hand — better than a row that says
  // deleted while the event is still live on the calendar.
  let googleFailed = false;
  if (before?.status === "approved" && before.sync_status === "synced") {
    const result = await deleteGoogleEvent(id);
    googleFailed = !result.ok;
  }

  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not delete that: ${error.message}`,
    };
  }

  revalidateEverywhere();
  return {
    status: "success",
    errors: {},
    message: googleFailed
      ? "Deleted here, but Google Calendar didn't respond — remove it there by hand."
      : "Deleted.",
  };
}

/**
 * Push everything that isn't on the ward calendar yet.
 *
 * This is the entire recovery story — there is no background retry or backoff.
 * At single-digit approvals a day, a button an admin presses when they see the
 * banner is simpler than a queue, and it doubles as the way to push the backlog
 * the first time credentials are added.
 */
export async function retrySync(
  _previous: EventActionState,
): Promise<EventActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  if (!isSyncEnabled()) {
    return {
      status: "error",
      errors: {},
      formError:
        "Google Calendar isn't connected yet. Add the credentials described in docs/HANDOFF.md first.",
    };
  }

  const supabase = await createClient();
  const { data: pendingSync, error } = await supabase
    .from("events")
    .select(
      "id, title, location, description, event_date, start_time, end_time, repeats_weekly, repeat_until",
    )
    .eq("status", "approved")
    .in("sync_status", ["failed", "not_synced"]);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not read the backlog: ${error.message}`,
    };
  }

  const rows = pendingSync ?? [];
  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await pushEvent({
      id: row.id,
      title: row.title,
      location: row.location,
      description: row.description,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      repeatsWeekly: row.repeats_weekly,
      repeatUntil: row.repeat_until,
    });
    await recordSync(supabase, row.id, result);
    if (result.ok) synced += 1;
    else failed += 1;
  }

  revalidateEverywhere();

  if (rows.length === 0) {
    return {
      status: "success",
      errors: {},
      message: "Everything is already on the ward calendar.",
    };
  }

  return {
    status: failed === 0 ? "success" : "error",
    errors: {},
    message: `Sent ${synced} of ${rows.length} to Google.`,
    formError:
      failed > 0
        ? `${failed} still didn't go through. Try again in a few minutes.`
        : undefined,
  };
}
