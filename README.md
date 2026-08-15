# Provo YSA 147th Ward website

A small, warm, mobile-first site for the ward: what's happening, which groups
you can join, and a straight line into the ward GroupMe. Every piece of content
is editable through the site itself.

**Running it, and handing it over:** [`docs/HANDOFF.md`](docs/HANDOFF.md). That
is the document to read if you have inherited this and just need it to work.

## Stack

Next.js 16 (App Router) · Supabase (Postgres, magic-link auth, row-level
security) · Tailwind CSS v4 · Vercel. Everything runs on free tiers.

## Local development

You need Node 20+, Docker (for the local Supabase stack), and the Supabase CLI
(installed as a dev dependency, so `npx supabase` works).

```bash
npm install
npx supabase start
```

`supabase start` prints the local URL and keys. Put them in `.env.local`:

```bash
cp .env.example .env.local
```

Then fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
and `SUPABASE_SECRET_KEY` from what `supabase start` printed. Load sample data
and run the site:

```bash
npx supabase db reset
npm run dev
```

The site is at `http://localhost:3000`. Sign in at `/admin` with
`admin@example.com` — the sign-in email lands in the local mail catcher at
`http://127.0.0.1:54324`, not a real inbox.

> Run the dev server on port **3000**. Supabase's local `site_url` points there,
> and the magic links it sends are absolute.

## Layout

```
app/            routes — public pages, /survey, /admin, /auth/confirm
components/     UI, calendar, forms, admin
lib/            pure logic (dates, occurrences, Google mapping) and data access
supabase/       migrations, seed data, local config
tests/db/       the security model, against a real database
tests/e2e/      whole flows in a browser
```

Two rules keep this from tangling:

- **Pure modules stay pure.** `lib/date.ts`, `lib/events.ts`,
  `lib/categories.ts`, and `lib/validation/*` do no I/O and import no Supabase
  client — and so does the Google event mapping, which is the reason its
  awkward cases (all-day spans, past-midnight events, DST) are cheap to test
  hard.
- **Reads go through `lib/queries.ts`; writes go through server actions.**
  Events are read from the ward's Google Calendar rather than the database, and
  that read is the one allowed to fail quietly: a Google outage empties the
  events region and leaves the rest of the page alone.

## Checks

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build
```

```bash
npm run test:db
```

```bash
npm run test:e2e
```

`test:db` and `test:e2e` need the local Supabase stack (`npx supabase start`)
and a seeded database (`npx supabase db reset`).

The end-to-end suite feeds the app a fixture calendar instead of live Google
credentials: `playwright.config.ts` writes one from
`tests/e2e/fixtures/calendarEvents.ts` and points `CALENDAR_FIXTURES` at it.
That variable names a file inside `tests/e2e/fixtures` and is ignored entirely
on Vercel, so it can never serve canned events to a visitor.

## Deploying

See [`docs/HANDOFF.md`](docs/HANDOFF.md) section 2. In short: import into
Vercel, set the Supabase, cron, and Google Calendar environment variables, share
the ward calendar with the service account, and point Supabase's redirect URLs
at the deployed address.
