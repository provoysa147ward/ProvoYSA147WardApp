---
date: 2026-08-05
topic: ysa-ward-website
---

# Provo YSA 147th Ward Website

## What We're Building

A warm, inviting, mobile-first website for the Provo YSA 147th Ward that answers "what's
happening and how do I join in." Three public surfaces: a **home page** (welcome blurb with
ward identity and Sunday meeting info, an admin-editable announcement banner, upcoming
events, a quick-links row, and a button to the calendar), a **calendar page** (a hand-built
pastel month grid on desktop — modeled on the reference screenshot — collapsing to a
scrolling agenda list on phones), and a **groups page** (activity groups, each with a name,
description, emoji/photo, meeting time + location, and a "Join on GroupMe" button).

Anyone can suggest an event through an open form (no account needed — name + contact
included so admins can follow up). Events appear only after an admin approves them from a
logged-in admin tab; approved events are automatically pushed to a ward Google Calendar so
members can subscribe. All content — events, groups, announcements, links, contact info —
is edited through simple admin forms backed by Supabase, so normal operation never requires
a code change. The admin area displays Ethan's email and phone as the escape hatch for
anything the forms can't fix. Stack: Next.js (App Router) + Supabase, deployed on Vercel's
free tier at a free `.vercel.app` subdomain.

## Why This Approach

Three build approaches were considered:

- **A. Custom calendar grid (chosen)** — Next.js + Supabase with our own CSS-grid month
  view and pastel event chips. Full control over the warm aesthetic in the reference
  screenshot, a first-class mobile agenda view, tiny bundle, no calendar library to fight
  or keep updated. We own the date math (mitigated by `date-fns`), which is acceptable
  given the simple recurrence model.
- **B. Calendar library (FullCalendar / react-big-calendar)** — rejected: heavyweight,
  restyling it to the screenshot costs the time it saves, mediocre on mobile, 90% of its
  features unused.
- **C. Static pages + Google Calendar iframe embed** — rejected: kills the approval
  workflow, looks dated, can't be warm or mobile-friendly.

For the admin experience, three levels were considered: (A) a Claude API chat with GitHub
code access, (B) plain content-editing forms, (C) forms plus a Claude content assistant.
**Level B was chosen deliberately**: the site's core requirement is being *completely
self-sufficient* after Ethan moves out, and levels A/C both require an Anthropic API
account with a funded credit card that must outlive any one member's tenure — the exact
single-point-of-failure the site is meant to design away. With every editable thing living
in Supabase behind friendly forms, there is nothing to fund, expire, or hand off.

## Key Decisions

- **Events live in Supabase; one-way push to Google Calendar**: The site is the source of
  truth (required for the submit-and-approve flow). On approval, events are pushed to a
  ward Google Calendar via the Google Calendar API — one-way only, so no conflict/duplicate
  handling. No ward Google Calendar currently exists; one will be created on the ward
  Google account.
- **Full Google push ships in v1**: The user chose day-one auto-sync over deferring it.
  Entailments accepted: creating/sorting out the ward Google account, a Google Cloud
  project, service-account credentials, and sharing the ward calendar with that service
  account before launch. Per-event "Add to Google Calendar" links are trivial to include as
  well.
- **Admins = small list of admin emails**: Ward email plus a few leaders' personal emails.
  The ward email is permanently on the list; logged-in admins can add/remove others (YSA
  turnover is constant). Admin login via Supabase magic links — no passwords to lose or
  share.
- **Open event submission, no accounts**: Anyone can submit via a public form with their
  name + contact. The approval queue is the spam/junk filter. No submitter notifications —
  approved events simply appear (no email service to set up or maintain).
- **Simple weekly recurrence only**: An event may repeat weekly until an end date (covers
  volleyball night, institute, FHE). No biweekly/monthly rules or per-occurrence
  exceptions; rare complex schedules are entered as one-offs.
- **Fixed event categories with set pastel colors**: A small built-in set (e.g. Sports,
  Spiritual, Social, Service, Other), each with its own pastel chip color. Submitters pick
  a category; the calendar stays cohesive with zero category-management UI.
- **Groups page fields**: name, description, emoji or photo, meeting time + location (plain
  text), GroupMe join link. No per-group contact person.
- **Home page contents**: welcome blurb + ward identity (including Sunday meeting
  time/building), announcement banner (hidden when empty), upcoming events with a calendar
  button, quick-links row.
- **Free `.vercel.app` subdomain, no custom domain**: $0 forever, nothing to renew or
  expire — avoids attaching a recurring bill to anyone's card.
- **Contact info in the admin area only**: Ethan's email + phone appear inside the
  logged-in admin tab next to the editing tools, not on the public site.
- **Unofficial-site disclaimer in the footer**: "This is an unofficial site maintained by
  ward members, not an official website of the Church of Jesus Christ of Latter-day
  Saints." No official Church logos used, per Church branding guidance.
- **No AI integration (Level B admin)**: All editing via forms; no Claude API, GitHub
  tokens, or usage billing. Rationale above.

## Open Questions

- **Ward Google account access**: Who currently controls the ward Gmail/Google account, and
  can a Google Cloud project + service account be created under it before v1? (Blocking for
  the Google push; the fallback is shipping "Add to Google Calendar" links first and
  enabling the push when access is sorted.)
- **Supabase project ownership**: The Supabase org should be created under the ward email
  (not Ethan's personal account) for the same hand-off reasons as everything else — confirm
  during setup.
- **Event fields**: Assumed title, category, date, start/end time, location, description,
  optional weekly repeat + end date, submitter name + contact. Confirm nothing else is
  needed (e.g. cost, signup link) during planning.
- **Announcement banner**: single announcement or multiple concurrent? Assumed single
  (simplest) — confirm in planning.
- **Timezone**: All times fixed to America/Denver; no timezone UI. Assumed fine — confirm.
