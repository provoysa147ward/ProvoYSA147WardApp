---
date: 2026-08-14
topic: groupme-survey-calendar-flip
---

# GroupMe Banner, New Member Survey, Calendar Views, and Google-as-Source-of-Truth

## What We're Building

Three homepage changes and a calendar overhaul. The homepage leads with a
visually distinct "Join the Ward GroupMe" hero banner card (linking to
https://groupme.com/join_group/96448094/VfvOov1r) above the current hero
heading. The "Suggest an event" blurb is replaced by a "New Member Survey"
link pointing at a placeholder page for now (real survey wired up later), and
the public suggest-an-event flow (`/submit` page, form, server action) is
removed entirely. The homepage keeps its "Coming up" next-events section.

The calendar page gains a view switcher — Schedule, Day, Week, Month — built
by extending the existing hand-rolled calendar components. The chosen view is
saved in localStorage; first-time visitors default to Month on desktop and
Schedule on mobile, and a saved choice wins thereafter.

Separately, the event data flow flips: the ward's Google Calendar becomes the
source of truth. The site fetches events server-side from the Google Calendar
API (cached for a few minutes) instead of reading the Supabase `events` table.
Leaders create and edit events in Google Calendar and they appear on the site
shortly after. The one-way site→Google push, the Supabase events table, the
admin event-approval queue, and the sync banner all retire.

## Why This Approach

**Calendar views — extend the hand-rolled calendar** (over adopting
react-big-calendar/FullCalendar, or list-only day/week views): the existing
`CalendarView`/`MonthGrid`/`AgendaList` code is small, styled to match the
site, and already tested. A library adds bundle weight and Tailwind v4
restyling work for capabilities (drag-and-drop, dense schedules) a ward
calendar doesn't need. Schedule view is the existing agenda list; Day and Week
are net-new but reuse the same occurrence logic.

**Flipped flow — direct fetch from Google** (over a cron that syncs Google
into Supabase, or keeping the site as source of truth): fetching from the
Google Calendar API at request time with short-lived caching is the simplest
architecture that matches how the ward actually wants to work — leaders manage
events in Google Calendar. A cron-into-Supabase design keeps the old read path
but adds sync infrastructure, failure modes, and staleness for no user-visible
benefit. The existing service-account credentials (`GOOGLE_SA_CLIENT_EMAIL`,
`GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`) already grant calendar access,
so no new setup is needed — the scope changes from write to read.

## Key Decisions

- **GroupMe banner card at the top of the homepage**: a distinct card above
  the hero H1 with a prominent join button — the first thing a visitor sees.
- **"New Member Survey" replaces "Suggest an event"**: placeholder page for
  now (e.g., `/survey` stub); the real survey (external form or built-in) is
  decided later.
- **Remove the suggest-an-event flow entirely**: `/submit` page,
  `SubmitEventForm`, `submitEvent` server action, and its validation schema
  are deleted. With Google as the source of truth, the pending-approval
  pipeline has no purpose anyway.
- **Calendar view switcher with four views, extending existing components**:
  Schedule (existing `AgendaList`), Month (existing `MonthGrid`), Day and Week
  (new). The current CSS-breakpoint mobile/desktop split is replaced by the
  switcher.
- **View preference persisted in localStorage with smart defaults**: no saved
  preference → Month on desktop, Schedule on mobile; a user's explicit choice
  is saved and wins on return visits. URL `?month=` navigation stays.
- **Google Calendar is the source of truth**: the site reads events from the
  Google Calendar API server-side with short-lived caching (a few minutes);
  Supabase no longer stores events. `lib/google/calendar.ts` push functions,
  the admin event screens/approval queue, `SyncBanner`, and the
  `events`/`events_public` tables retire. Recurring events can be expanded by
  the Google API (`singleEvents=true`), which may simplify or replace the
  client-side recurrence expansion in `lib/events.ts`.
- **Homepage keeps the "Coming up" section**, now fed by the Google fetch.

## Open Questions

- Which Google API read pattern: expand recurrences via `singleEvents=true`
  (simplest) vs. keep the site's own expansion logic? Decide in planning after
  checking what event fields the views need.
- Caching mechanics on Vercel: ISR/`revalidate` interval vs. runtime cache,
  and the acceptable staleness window (a few minutes assumed).
- Failure behavior when the Google API is down or slow: show a cached copy,
  an empty state with a message, or both?
- What remains of `/admin` after event management moves to Google
  (announcements and quick links still live there?) — audit during planning.
- The subscribable-calendar link and "Add to Google Calendar" per-event links
  should survive the flip — verify they need no changes.
- Placeholder `/survey` page copy, and where the real survey will eventually
  live (external Google Form vs. built-in Supabase-backed form).
