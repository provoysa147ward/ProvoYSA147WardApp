"use server";

import { checkRateLimit } from "@vercel/firewall";

import { fieldErrors } from "@/lib/validation/fieldErrors";
import { createClient } from "@/lib/supabase/server";
import {
  eventSubmissionSchema,
  isHoneypotTripped,
} from "@/lib/validation/event";

import type { SubmitState } from "./submit-state";

/** Matches the rule that must be created once in the Vercel dashboard. */
const RATE_LIMIT_ID = "event-submit";

/**
 * Accept an event suggestion.
 *
 * Everything lands as `status = 'pending'` — the database default, which anon
 * has no grant to override. The approval queue, not this function, is what
 * keeps the public calendar clean.
 */
export async function submitEvent(
  _previous: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const raw = {
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
    website: formData.get("website") ?? "",
  };

  // A tripped honeypot gets the same confirmation a person would see. Telling
  // a bot it was caught just invites it to retry without the field.
  if (isHoneypotTripped(raw)) {
    return { status: "success", errors: {} };
  }

  const parsed = eventSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      errors: fieldErrors(parsed.error.issues),
    };
  }

  // No-ops outside Vercel, so this has to be verified on a preview deployment
  // rather than locally.
  try {
    const { rateLimited } = await checkRateLimit(RATE_LIMIT_ID);
    if (rateLimited) {
      return {
        status: "error",
        errors: {},
        formError:
          "That's a lot of suggestions at once! Give it a minute and try again.",
      };
    }
  } catch {
    // A rate-limit outage must not take the form down with it — the approval
    // queue is still the real filter.
  }

  const event = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("events").insert({
    title: event.title,
    category: event.category,
    event_date: event.eventDate,
    start_time: event.startTime,
    end_time: event.endTime,
    location: event.location,
    description: event.description,
    repeats_weekly: event.repeatsWeekly,
    repeat_until: event.repeatUntil,
    submitter_name: event.submitterName,
    submitter_contact: event.submitterContact,
  });

  if (error) {
    return {
      status: "error",
      errors: {},
      formError:
        "Something went wrong saving that. Try again in a moment — nothing was lost.",
    };
  }

  return { status: "success", errors: {} };
}
