import type { IsoDate } from "@/lib/date";

/**
 * The ward's GroupMe join link.
 *
 * Defined once here because it is the site's single most important call to
 * action and appears in several places — the homepage banner, the survey
 * placeholder, and the empty states that used to point at the suggestion form.
 */
export const GROUPME_JOIN_URL =
  "https://groupme.com/join_group/96448094/VfvOov1r";

/**
 * The home page's fixed text.
 *
 * These used to be a database row with an admin screen in front of it, which
 * in practice nobody ever edited — the ward's copy has been the same since
 * launch. Changing any of them now means a code change and a deploy, which is
 * the honest cost of text that changes once a year. See migration 0003.
 *
 * Typed as plain `string`/`IsoDate | null` rather than by inference, so an
 * empty value here does not narrow to a literal type and make the code that
 * reads it look unreachable.
 */
export const WELCOME_BLURB: string =
  "Welcome! This is where we keep track of what's happening in the ward.";

/** Shown as a bordered line under the blurb. Empty hides it. */
export const SUNDAY_MEETING_INFO: string = "";

/** Empty hides the banner entirely — that is how it is turned off. */
export const ANNOUNCEMENT: string = "";

/** Optional: the banner hides itself on its own once this date has passed. */
export const ANNOUNCEMENT_EXPIRES: IsoDate | null = null;

/**
 * The site's own public URL.
 *
 * Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` automatically, so a deploy needs
 * no configuration for this — `NEXT_PUBLIC_SITE_URL` is only there if the ward
 * ever puts a custom domain in front.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
