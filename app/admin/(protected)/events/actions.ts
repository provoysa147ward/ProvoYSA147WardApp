"use server";

import { revalidatePath } from "next/cache";

import {
  NotAdminError,
  NotAuthenticatedError,
  createClient,
  requireAdmin,
} from "@/lib/supabase/server";
import { adminEventSchema, toEventRow } from "@/lib/validation/adminEvent";

import type { EventActionState } from "./action-state";

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

  revalidateEverywhere();
  return { status: "success", errors: {}, message: "Approved." };
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
  const { error } = await supabase
    .from("events")
    .insert({ ...toEventRow(parsed.data), status: "approved" });

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not create that: ${error.message}`,
    };
  }

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
  const { error } = await supabase.from("events").delete().eq("id", id);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not delete that: ${error.message}`,
    };
  }

  revalidateEverywhere();
  return { status: "success", errors: {}, message: "Deleted." };
}
