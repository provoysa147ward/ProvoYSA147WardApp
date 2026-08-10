import { z } from "zod";

import { EVENT_CATEGORIES } from "@/lib/categories";
import { addCalendarDays, wardToday } from "@/lib/date";

/**
 * The event submission schema — one definition used by the browser for inline
 * errors and by the server action as the source of truth. Anything the server
 * accepts is defined here and nowhere else.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

const isoDate = (label: string) =>
  z
    .string()
    .regex(ISO_DATE, `${label} must be a real date.`)
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
      message: `${label} must be a real date.`,
    });

const isoTime = (label: string) =>
  z.string().regex(ISO_TIME, `${label} must be a time like 7:00 PM.`);

/** An optional text field arrives as "" from an unfilled HTML input. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

const optionalTime = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine((value) => value === null || ISO_TIME.test(value), {
    message: "End time must be a time like 9:00 PM.",
  });

export const MAX_REPEAT_DAYS = 366;

export const eventSubmissionSchema = z
  .object({
    title: trimmed(1, 120, "Title"),
    category: z.enum(EVENT_CATEGORIES, {
      message: "Choose a category.",
    }),
    eventDate: isoDate("Date"),
    startTime: isoTime("Start time"),
    endTime: optionalTime,
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
    submitterName: trimmed(1, 100, "Your name"),
    submitterContact: trimmed(1, 200, "Your email or phone"),
    /**
     * Honeypot. A real person never sees this field, so anything in it means a
     * bot. Named `website` because that is what bots look for.
     */
    website: z
      .string()
      .max(0, "This submission looks automated.")
      .optional()
      .default(""),
  })
  .superRefine((value, ctx) => {
    const today = wardToday();

    if (value.eventDate < today) {
      ctx.addIssue({
        code: "custom",
        path: ["eventDate"],
        message: "Pick a date that hasn't passed yet.",
      });
    }

    // An end time earlier than the start means the event runs past midnight,
    // which is allowed. An end time equal to the start is a zero-length event,
    // which is not.
    if (value.endTime !== null && value.endTime === value.startTime) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message:
          "End time must be different from the start time. Leave it blank if you're not sure.",
      });
    }

    if (value.repeatsWeekly) {
      if (value.repeatUntil === null) {
        ctx.addIssue({
          code: "custom",
          path: ["repeatUntil"],
          message: "Tell us the last date this should repeat.",
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
          value.repeatUntil >
          addCalendarDays(value.eventDate, MAX_REPEAT_DAYS)
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

export type EventSubmission = z.infer<typeof eventSubmissionSchema>;

/** True when the honeypot was filled in. */
export function isHoneypotTripped(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "website" in raw &&
    typeof (raw as { website: unknown }).website === "string" &&
    (raw as { website: string }).website.trim() !== ""
  );
}
