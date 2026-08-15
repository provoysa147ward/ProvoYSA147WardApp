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
