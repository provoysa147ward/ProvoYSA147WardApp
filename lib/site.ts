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
