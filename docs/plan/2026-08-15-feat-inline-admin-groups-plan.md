---
title: "feat: inline admin editing on /groups"
type: feat
date: 2026-08-15
---

## feat: inline admin editing on /groups - Standard

## Overview

Admins manage groups directly on the public `/groups` page instead of on a
separate admin screen. The `/groups` server component checks admin status with
the existing `checkAdmin()`; a signed-in admin sees an "Add group" button and
Edit/Delete controls on each card, with add/edit in a modal dialog that reuses
today's form fields, `saveGroup`/`deleteGroup` server actions, Zod validation,
and the Supabase Storage photo flow. Non-admins see exactly the current page.

At the same time the admin surface shrinks: `/admin/groups` and
`/admin/content` are deleted, site-settings text becomes hardcoded constants,
the `site_settings` table is dropped, quick-links management moves onto the
`/admin` dashboard, and a discreet footer "Admin" link makes sign-in
discoverable. After sign-in the admin lands on `/groups` with controls visible.

Source brainstorm: `docs/brainstorm/2026-08-15-inline-admin-groups-brainstorm-doc.md`.

## Problem Statement / Motivation

Editing groups today means leaving the site for `/admin/groups`, a parallel UI
that duplicates the public rendering and has to be maintained separately. The
ward's admins are non-developers; editing the thing they are looking at is the
simpler mental model. Shrinking `/admin` to quick links + allowlist also
removes a whole class of content-editing UI (site settings) that in practice
never changes.

## Proposed Solution

Server-rendered inline controls (approach 1 of the brainstorm): the public page
becomes admin-aware via a server-side `checkAdmin()` call and conditionally
renders admin UI. No edit-mode framework, no client-side auth.

### Decisions on the brainstorm's open questions

1. **Hardcoded site-settings values live in `lib/site.ts`** as exported
   constants (`WELCOME_BLURB`, `SUNDAY_MEETING_INFO`, `ANNOUNCEMENT`,
   `ANNOUNCEMENT_EXPIRES`), next to `GROUPME_JOIN_URL` which set the precedent.
   The announcement keeps its expiry logic in `app/page.tsx`, now fed by
   constants (`ANNOUNCEMENT = ""` hides the banner, same as today's empty
   string). The `contact_*` fields are dropped entirely — they render nowhere
   public and `docs/HANDOFF.md` already covers "who to ask" at handover.
   Each constant carries a doc comment (in the `GROUPME_JOIN_URL` style)
   saying changing it means a code change and a deploy.
   The `site_settings` table **is dropped** by a new migration
   (`0003_drop_site_settings.sql`), following the `0002_drop_events.sql`
   precedent. Deploy order matters: code first, then `supabase db push`
   (old code reads the table; new code does not).
2. **Footer "Admin" link is a plain, always-visible small text link** to
   `/admin` in the root-layout footer. No session-aware swap to "Sign out" —
   that would put a `cookies()` read in the root layout for every visitor.
   Sign-out stays on the `/admin` dashboard, one click away.
3. **Leftover `events` schema remnants are out of scope** (non-goal).
4. **`docs/HANDOFF.md` is updated in this plan** (Phase 3): the "two rules"
   become "events in Google Calendar, groups edited on the site itself at
   `/groups`, quick links and admins at `/admin`, fixed page text changed via
   code"; day-to-day and test sections updated to match.

### Flow decisions (from user-flow analysis)

- **Per-card dialogs, not one shared dialog.** Each card owns its editor
  dialog (native `<dialog>`, same pattern as `components/ui/ConfirmDialog.tsx`),
  so action state stays isolated per group, matching the codebase idiom. A
  modal — rather than `GroupManager`'s old always-mounted `<details>` expand —
  because this is a public card grid that should not sprawl into open forms.
- **One form for add and edit.** `AddGroupButton` and each card's Edit control
  open the same parameterized dialog component (`GroupEditor`, taking an
  optional `group` — the direct descendant of `GroupManager`'s `GroupForm`).
  The field set is not duplicated between the two flows.
- **Dialog lifecycle:** the dialog shell stays mounted (it needs `showModal()`),
  but the form body renders only while the dialog is open — so closing
  unmounts it and reopening starts fresh, with no stale typed values or stale
  success banner and no reset machinery. On a validation error the dialog
  stays open showing the field/form errors; the inputs themselves reset after
  the action returns (React 19 resets uncontrolled fields when a form action
  completes — this matches today's `GroupForm` behavior, and a chosen file
  can never be programmatically restored anyway). On
  `state.status === "success"` the dialog closes itself via an effect; the
  revalidated grid is the visible confirmation, and the success message is
  announced from a visually-hidden `role="status"` live region.
- **Delete** keeps `ConfirmDialog`; a delete failure renders as a
  `role="alert"` message in the card's admin-controls row (today it renders
  inside the always-open form, which no longer exists).
- **Vanished-row honesty:** `saveGroup`'s update branch and `deleteGroup`
  add `.select("id")` and treat zero returned rows as an error ("That group
  no longer exists — reload the page.") instead of reporting false success
  when another admin deleted the row first. Simultaneous edits stay
  last-write-wins (2–3 admins; accepted).
- **Admin empty state:** with zero groups an admin sees empty-state copy
  pointing at the Add group button, not "check back soon".
- **Signed-in non-admin on `/groups`** (removed between email and click) sees
  the plain public page; their escape hatch is footer → `/admin`, which
  renders the existing 403 page with its Sign out button. Mid-session removal
  inside an open dialog surfaces as the existing `guardMessage` form error.
- **Old admin URLs 404.** No redirect stubs for `/admin/groups` or
  `/admin/content` — two or three admins will relearn instantly (YAGNI).
- **Post-sign-in landing:** `app/auth/confirm/route.ts` success redirects
  change from `/admin` to `/groups`. The footer link still points at `/admin`
  (dashboard remains useful); the asymmetry is accepted, and a `next` param
  on `/auth/confirm` is out of scope.

## Technical Considerations

- **Security model unchanged.** All four gate layers hold: the proxy still
  guards `/admin/*`; the `(protected)` layout still gates remaining admin
  pages; `saveGroup`/`deleteGroup` keep `requireAdmin()` and merely move files
  (server actions are independently-invocable POST endpoints — the guard
  inside them is what matters, not the route group they sit in); RLS is
  untouched except for dropping `site_settings` (its policies go with the
  table). `checkAdmin()` on `/groups` is a rendering decision only.
- **`AdminActionState` moves out of the route group.** It lives in
  `app/admin/(protected)/action-state.ts` and will be shared by
  `app/groups/actions.ts`; move it to `lib/adminActionState.ts` and update all
  importers (admins actions, AdminListManager, quick-link actions/manager).
  It cannot merge into the neighboring `lib/adminActionSupport.ts`: that file
  is `server-only` (`guardMessage`), while client components import the state
  type.
- **`revalidateGroups()`** drops the `/admin/groups` path.
- **Keepalive route** (`app/api/keepalive/route.ts`) currently pings
  `site_settings` with `.eq("id", 1).maybeSingle()`; switch to
  `groups` with `.select("id").limit(1)` — zero rows is success (the query
  itself proves the database is awake), and update the route's comment.
- **`/groups` render cost:** one extra `auth.getUser()` round-trip per
  request; `getUser()` short-circuits with no auth cookie, so anonymous
  traffic is barely affected. The page is already dynamic (Supabase reads).
- **Component testability:** the editor component imports server actions;
  its vitest file mocks `@/app/groups/actions` (jsdom cannot run them).

## Implementation Phases

### Phase 1: Inline group editing on /groups

- **Status:** Done
- **Scope:** Admin controls and the editor dialog on `/groups`; group server
  actions move to `app/groups/actions.ts` (with the vanished-row fix);
  `/admin/groups` and `GroupManager` are deleted; `AdminActionState` moves to
  `lib/adminActionState.ts`; admin nav/dashboard lose the Groups entry.
- **Files touched:**
  - `app/groups/page.tsx` — call `checkAdmin()`, pass `isAdmin`, render
    `AddGroupButton` and per-card controls, admin-aware empty state
  - `app/groups/actions.ts` — moved from `app/admin/(protected)/groups/actions.ts`;
    drop `/admin/groups` revalidation; add `.select("id")` zero-row errors
  - `components/groups/GroupEditor.tsx` — new client components; the primary
    export is `GroupEditor` (the dialog-wrapped form, optional `group` prop,
    fields carried over from `GroupManager`, form body mounted only while
    open, success auto-close, `role="status"` live region), plus
    `AddGroupButton` and `GroupCardControls` (Edit + delete `ConfirmDialog`)
  - `components/groups/GroupEditor.test.tsx` — new (mocks the actions module):
    fields render with group defaults; dialog opens/closes; success closes the
    dialog; reopen shows fresh state; error keeps the dialog open showing the
    message; delete failure renders the `role="alert"` in the controls row
  - `lib/adminActionState.ts` — moved from `app/admin/(protected)/action-state.ts`;
    update importers (`app/admin/(protected)/admins/actions.ts`,
    `app/admin/(protected)/content/actions.ts`,
    `components/admin/AdminListManager.tsx`, `components/admin/ContentManager.tsx`)
  - Deleted: `app/admin/(protected)/groups/page.tsx`,
    `app/admin/(protected)/groups/actions.ts`, `components/admin/GroupManager.tsx`,
    `app/admin/(protected)/action-state.ts`
  - `app/admin/(protected)/layout.tsx` — drop the Groups nav link; amend the
    layout's gate docstring (group mutations now live outside `(protected)`,
    resting on `requireAdmin()` + RLS); same one-line amendment to the
    `proxy.ts` docstring
  - `app/admin/(protected)/page.tsx` — "Managed here" points at `/groups`
    (public page, edit inline) instead of `/admin/groups`
  - `tests/e2e/access.spec.ts` — nav assertion: Groups link gone from admin nav
- **Acceptance criteria:** `/groups` renders identically for anonymous
  visitors; the editor component's tests cover open/submit-error/success/
  reopen/delete-failure; `app/admin/(protected)/groups/` no longer exists;
  every remaining import of the action-state type resolves to
  `lib/adminActionState.ts`.
- **Validation:** `npm run lint && npx tsc --noEmit && npm run test && npm run build`
  — plus, with the local stack running (`supabase start`, local `.env.local`):
  `npm run test:e2e`

### Phase 2: Retire site settings, slim /admin to links + admins

- **Status:** Not started
- **Scope:** Site-settings text becomes constants; `/admin/content` is
  deleted; quick-links management moves onto the `/admin` dashboard;
  `site_settings` is dropped by migration; keepalive pings `groups`; db tests
  and seed updated.
- **Files touched:**
  - `lib/site.ts` — add `WELCOME_BLURB`, `SUNDAY_MEETING_INFO`,
    `ANNOUNCEMENT` (empty string = hidden), `ANNOUNCEMENT_EXPIRES`
    (`IsoDate | null`), values copied from today's production text
  - `app/page.tsx` — read the constants; drop `getSiteSettings` from the
    `Promise.all`; `Announcement` takes the constants
  - `lib/queries.ts` — remove `getSiteSettings`, `SiteSettings`,
    `EMPTY_SITE_SETTINGS`; `lib/queries.test.ts` follows if it covers them
  - `lib/validation/admin.ts` — remove `siteSettingsSchema` (+ its cases in
    `lib/validation/admin.test.ts`)
  - `components/admin/QuickLinksManager.tsx` — new, extracted from
    `ContentManager.tsx` (QuickLinksSection/QuickLinkForm/Banner unchanged)
  - `app/admin/(protected)/actions.ts` — new home for `saveQuickLink`/
    `deleteQuickLink` (settings action deleted); revalidates `/` and `/admin`
  - `app/admin/(protected)/page.tsx` — render `QuickLinksManager` below the
    existing sections; "Managed here" reflects the new scope
  - Deleted: `app/admin/(protected)/content/page.tsx`,
    `app/admin/(protected)/content/actions.ts`,
    `components/admin/ContentManager.tsx`
  - `app/admin/(protected)/layout.tsx` — drop the Content nav link
  - `app/api/keepalive/route.ts` — ping `groups` (`select("id").limit(1)`),
    comment updated
  - `supabase/migrations/0003_drop_site_settings.sql` — drop the table (its
    policies and grants go with it)
  - `supabase/seed.sql` — remove the `site_settings` update
  - `tests/db/rls.test.ts` — remove `site_settings` from the world-readable
    list and its update/single-row specs; the "lets an admin write all three"
    spec also writes and restores `site_settings` — reword it to cover the
    remaining two tables
  - `tests/db/turnover.test.ts` — update the comment that references the
    shared `site_settings` row if the code it explains changed
  - `tests/e2e/public.spec.ts` — drop the seeded-announcement assertion
    (`/Ward temple night/`); keep the heading/Coming-up assertions
- **Acceptance criteria:** no file under `app/`, `lib/`, or `components/`
  references `site_settings` or `SiteSettings`; `/admin` shows quick-links
  management; the home page renders the same text as before from constants.
- **Validation:** `npm run lint && npx tsc --noEmit && npm run test && npm run build`
  — plus, with the local stack running (`supabase start`, local `.env.local`):
  `npm run test:db && npm run test:e2e`

### Phase 3: Footer sign-in entry, /groups landing, e2e + docs

- **Status:** Not started
- **Scope:** Discreet footer "Admin" link; post-sign-in redirect to `/groups`;
  e2e helpers and specs updated; new e2e coverage for inline editing
  visibility; handoff docs rewritten to the new admin scope.
- **Files touched:**
  - `app/layout.tsx` — small plain-text "Admin" link in the footer,
    `text-ink-muted`, pointing at `/admin`
  - `app/auth/confirm/route.ts` — both success redirects: `/admin` → `/groups`
  - `tests/e2e/support.ts` — `signInAsAdmin`/`signInThroughEmail` wait for the
    admin marker on `/groups` (the "Add group" button) instead of
    `Signed in as …`
  - `tests/e2e/access.spec.ts` — "an admin lands …" now asserts landing on
    `/groups` with controls visible, then navigates to `/admin` for the
    Google-Calendar dashboard assertions; the reused-link spec's
    `Signed in as …` assertion (`access.spec.ts:75`) switches to the `/groups`
    admin marker; add specs: anonymous `/groups` shows no Add/Edit/Delete
    controls; a signed-in admin can add and edit a group through the dialog
    end-to-end (cleanup deletes the row); the footer Admin link is present
    and leads to sign-in
  - `docs/HANDOFF.md` — "two rules", section 3 (day-to-day), and the §5
    four-layer-gate description rewritten: groups are edited on `/groups`;
    quick links + admins at `/admin`; fixed text changed via code in
    `lib/site.ts`; group mutations live outside the `(protected)` route group
    and rest on `requireAdmin()` + RLS; test-suite table checked; note the
    deploy-then-migrate order for 0003
  - `README.md` — only if it references the retired admin pages
- **Acceptance criteria:** signing in from the footer link round-trips back
  to `/groups` with editing controls visible; all e2e specs pass against the
  local stack; HANDOFF describes the new admin scope.
- **Validation:** `npm run lint && npx tsc --noEmit && npm run test && npm run build`
  — plus, with the local stack running: `npm run test:e2e`

## Success Criteria

```success-criteria
GOAL: Admins add, edit, and delete groups directly on the public /groups page; the separate groups/content admin screens and the site_settings table are gone; sign-in is reachable from the site footer and lands back on /groups.

SUCCESS CRITERIA:
- The retired admin routes are deleted | verify: test ! -e "app/admin/(protected)/groups" && test ! -e "app/admin/(protected)/content"
- No app code references the dropped site_settings surface | verify: ! grep -rn "site_settings\|SiteSettings" app lib components
- The dropped table has a migration | verify: test -f supabase/migrations/0003_drop_site_settings.sql
- Lint, types, unit/component tests, and the production build are green | verify: npm run lint && npx tsc --noEmit && npm run test && npm run build
- The security model still holds against a real database | verify: manual 1. `supabase start` (local `.env.local`) 2. `npm run test:db` exits 0
- Anonymous /groups shows no admin controls; an admin signs in via the footer link, lands on /groups, and can add, edit, and delete a group in the dialog | verify: manual 1. `supabase start` (local `.env.local`) 2. `npm run test:e2e` exits 0 (specs added in Phase 3 cover these flows)

NON-GOALS:
- A generic site-wide edit-mode framework
- Any change to the magic-link/allowlist sign-in flow or the four-layer gate
- Cleaning up leftover `events` schema remnants from migration 0002
- A `next`-param redirect on /auth/confirm
- Structured meeting-time fields (free text stays)
- Removing or replacing a group photo from the form (existing behavior carries over)

VERIFICATION COMMAND: npm run lint && npx tsc --noEmit && npm run test && npm run build
```

## Success Metrics

- Admins never visit `/admin` to manage groups; the only remaining admin
  screens are the dashboard (calendar pointer + quick links) and `/admin/admins`.
- Zero regressions on the public pages: anonymous HTML for `/groups` is
  unchanged except for the footer link.

## Dependencies & Risks

- **Deploy-then-migrate order for 0003.** If `supabase db push` runs before
  the new code deploys, the old code's `getSiteSettings` throws and the home
  page 500s. Sequence: merge + deploy, verify, then push the migration
  (documented in HANDOFF, same as the 0002 flip).
- **Local stack needed for `test:db`/`test:e2e`.** `vercel env pull`
  overwrites `.env.local` with production values — restore local values before
  running either suite (existing HANDOFF warning applies).
- **e2e helpers are load-bearing.** `signInAsAdmin` is used by every admin
  spec; the Phase 3 wait-condition change must land with the redirect change
  or the whole suite fails.
- **Photo-orphan debt carries over knowingly:** replacing a photo orphans the
  old Storage object; upload-then-DB-failure orphans a new one. Pre-existing,
  unchanged, out of scope.

## References & Research

- Brainstorm: `docs/brainstorm/2026-08-15-inline-admin-groups-brainstorm-doc.md`
- Admin gate: `lib/supabase/server.ts:74` (`checkAdmin`), `lib/supabase/server.ts:101`
  (`requireAdmin`), `proxy.ts:13`, `app/admin/(protected)/layout.tsx:35`
- Form + actions being reused: `components/admin/GroupManager.tsx:64`
  (`GroupForm`), `app/admin/(protected)/groups/actions.ts:62` (`saveGroup`),
  `lib/validation/admin.ts:41` (`groupSchema`)
- Dialog pattern to follow: `components/ui/ConfirmDialog.tsx:13`
- Site constants precedent: `lib/site.ts:8` (`GROUPME_JOIN_URL`)
- Keepalive read to repoint: `app/api/keepalive/route.ts:31`
- Drop-migration precedent: `supabase/migrations/0002_drop_events.sql`
- Tests that change: `tests/e2e/support.ts:102` (`signInAsAdmin`),
  `tests/e2e/access.spec.ts:87`, `tests/e2e/public.spec.ts:14`,
  `tests/db/rls.test.ts:45`
- Prior related PR: [#2 — Google Calendar as source of truth](https://github.com/EthDarBry/ProvoYSA147WardApp/pull/2)
