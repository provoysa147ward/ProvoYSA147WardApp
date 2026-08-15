import { z } from "zod";

import { EVENT_CATEGORIES } from "@/lib/categories";
import { addCalendarDays } from "@/lib/date";

/**
 * What an admin may write to an event.
 *
 * Admins can date an event in the past — correcting last week's entry is a
 * normal thing to do — and they fill in the submitter fields themselves when
 * they create an event directly.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

/** A weekly series runs for at most a year. */
export const MAX_REPEAT_DAYS = 366;

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const adminEventSchema = z
  .object({
    title: trimmed(1, 120, "Title"),
    category: z.enum(EVENT_CATEGORIES, { message: "Choose a category." }),
    eventDate: z.string().regex(ISO_DATE, "Date must be a real date."),
    startTime: z.string().regex(ISO_TIME, "Start time must be a time."),
    endTime: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .refine((value) => value === null || ISO_TIME.test(value), {
        message: "End time must be a time.",
      }),
    location: trimmed(1, 200, "Location"),
    description: optionalText(2000, "Description"),
    repeatsWeekly: z.boolean(),
    repeatUntil: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .refine((value) => value === null || ISO_DATE.test(value), {
        message: "Repeat-until must be a real date.",
      }),
    submitterName: trimmed(1, 100, "Submitted by"),
    submitterContact: trimmed(1, 200, "Contact"),
  })
  .superRefine((value, ctx) => {
    if (value.endTime !== null && value.endTime === value.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be different from the start time.",
      });
    }

    if (value.repeatsWeekly) {
      if (value.repeatUntil === null) {
        ctx.addIssue({
          code: "custom",
          path: ["repeatUntil"],
          message: "A repeating event needs a last date.",
        });
      } else {
        if (value.repeatUntil < value.eventDate) {
          ctx.addIssue({
            code: "custom",
            path: ["repeatUntil"],
            message: "The last date can't be before the first one.",
          });
        }
        if (
          value.repeatUntil > addCalendarDays(value.eventDate, MAX_REPEAT_DAYS)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["repeatUntil"],
            message: "Repeating events can run for at most a year.",
          });
        }
      }
    } else if (value.repeatUntil !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["repeatUntil"],
        message: "Turn on weekly repeat to set a last date.",
      });
    }
  });

export type AdminEventInput = z.infer<typeof adminEventSchema>;

/** Maps the validated shape onto the database column names. */
export function toEventRow(event: AdminEventInput) {
  return {
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
  };
}
