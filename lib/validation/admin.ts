import { z } from "zod";

/**
 * Schemas for everything an admin edits. Same contract as the submission
 * schema: shared by the form and the server action, with the server as the
 * source of truth.
 */

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

/** Links are https-only — no http, no javascript:, no protocol-relative. */
const httpsUrl = (label: string) =>
  z
    .url({ protocol: /^https$/, message: `${label} must start with https://` })
    .max(500, `${label} must be 500 characters or fewer.`);

const optionalHttpsUrl = (label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || httpsUrl(label).safeParse(value).success,
      { message: `${label} must start with https://` },
    );

export const groupSchema = z.object({
  name: trimmed(1, 100, "Group name"),
  description: trimmed(1, 1000, "Description"),
  emoji: optionalText(8, "Emoji"),
  photoUrl: optionalHttpsUrl("Photo URL"),
  meetingInfo: z
    .string()
    .trim()
    .max(200, "Meeting info must be 200 characters or fewer.")
    .default(""),
  groupmeUrl: optionalHttpsUrl("GroupMe link"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type GroupInput = z.infer<typeof groupSchema>;

export const quickLinkSchema = z.object({
  label: trimmed(1, 60, "Label"),
  url: httpsUrl("Link"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type QuickLinkInput = z.infer<typeof quickLinkSchema>;

/**
 * Admin emails are normalised here and again by a database trigger, so the
 * allowlist can never hold two spellings of the same address.
 */
export const adminEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address."))
    .pipe(z.string().max(320, "That email address is too long.")),
});

export type AdminEmailInput = z.infer<typeof adminEmailSchema>;
