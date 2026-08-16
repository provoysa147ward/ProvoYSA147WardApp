---
date: 2026-08-15
topic: inline-admin-groups
---

# Inline Admin Editing on /groups

## What We're Building

Admins will manage groups directly on the public `/groups` page instead of on the
separate `/admin/groups` page. The `/groups` server component checks admin status
with the existing `checkAdmin()` helper; when the visitor is a signed-in admin, the
page shows an "Add group" button and Edit/Delete controls on each group card. Both
add and edit open a modal dialog containing the group form (name, description,
emoji, photo upload, GroupMe link, free-text meeting time), reusing today's
`saveGroup`/`deleteGroup` server actions, Zod validation, and the Supabase Storage
photo-upload flow nearly unchanged. Non-admin visitors see exactly the current
static page.

At the same time, the admin surface shrinks. `/admin/groups` is deleted. The
site-settings half of `/admin/content` (welcome blurb, Sunday info, announcement,
contact fields) is removed from admin editing — those values become hardcoded and
change via code. A minimal `/admin` remains for quick links and the admin-email
allowlist. Calendar editing needs no work: events already live exclusively in
Google Calendar. Sign-in stays the magic-link flow, reached via a new discreet
"Admin" link in the site footer; after signing in the admin lands back on the site
with editing controls visible.

## Why This Approach

Three approaches were considered:

1. **Server-rendered inline controls (chosen).** The public page becomes
   admin-aware via a server-side `checkAdmin()` call and conditionally renders
   admin UI. Reuses the proven form, validation, upload flow, and the documented
   four-layer admin gate (proxy redirect → layout gate → `requireAdmin()` in every
   action → RLS) with the smallest possible diff. The only real cost is a little
   admin UI living inside a public page component.
2. **Generic site-wide edit-mode framework.** Rejected as YAGNI — only `/groups`
   needs inline editing today; quick links stay on `/admin`.
3. **Restyled separate admin page.** Rejected — it doesn't satisfy the core goal
   of editing directly on the website.

## Key Decisions

- **Admin scope shrinks to groups + links**: Groups move inline to `/groups`;
  quick links and the admin allowlist stay on a slimmed-down `/admin`;
  site-settings text editing is removed (hardcoded, changed via code). Keeps the
  admin's job simple, as requested.
- **Sign-in entry point is a discreet footer "Admin" link**: Keeps the existing
  magic-link/allowlist flow untouched while making sign-in discoverable from the
  site itself. After login, redirect back to the site (not the admin dashboard).
- **Meeting time stays free text**: The existing `meeting_info` field (≤200 chars)
  already fits "next time this group is meeting" and handles recurring schedules
  ("Thursdays 7pm at the church") without going stale or needing a picker.
- **Add/edit form appears in a modal dialog**: Same form for add and edit, opened
  over the groups grid; closing returns to the grid in place.
- **Reuse, don't rebuild**: `GroupForm`, `saveGroup`/`deleteGroup`,
  `groupSchema`, and the `group-photos` Supabase Storage upload flow carry over;
  the main new work is rendering admin controls on `app/groups/page.tsx` and
  removing the retired admin pages.
- **Security model unchanged**: Every mutation still passes `requireAdmin()` and
  RLS; the inline UI is only a rendering change. Any admin-scope removal must be
  mirrored across all four gate layers per `docs/HANDOFF.md`.

## Open Questions

- Where exactly do the retired site-settings values (welcome blurb, Sunday info,
  announcement, contact) get hardcoded — `lib/site.ts` constants, or inline in the
  components that render them? Also whether the `site_settings` table/rows get a
  drop migration now or are left dormant.
- Should the footer "Admin" link be visible to everyone, or only rendered subtly
  (e.g., plain text, small) — and should it switch to "Sign out" when an admin is
  signed in?
- Does deleting `/admin/groups` warrant cleaning up the leftover `events` schema
  remnants noted in `supabase/migrations`, or is that out of scope?
- `docs/HANDOFF.md`'s "two rules" and admin-gate docs will need updating to match
  the new admin scope — confirm during planning.
