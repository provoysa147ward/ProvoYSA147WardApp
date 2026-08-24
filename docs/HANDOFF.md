# Handoff — Provo YSA 147th Ward website

This is the document that matters. The site is designed so a non-developer can
run it indefinitely, and so that nobody's personal account is load-bearing. If
you are inheriting it, read this end to end once — it should take about fifteen
minutes.

**The site:** https://provoysa147ward.vercel.app — admin area at `/admin`.

**Where everything is edited:**

| What | Where |
|---|---|
| Events | The ward's **Google Calendar** |
| Groups | The **groups page itself** — sign in, and every card grows Edit and Delete |
| Quick links, admins | `/admin` |
| The home page's fixed text | In the code, `lib/site.ts` — a developer and a deploy |

The first three need no developer, ever. Only the last one does, and it is
three sentences that have not changed since the site launched. Sign-in is the
small **Admin** link at the very bottom of every page.

---

## 1. What you need custody of

Five accounts. All of them must be owned by the **ward's own email address**,
not by a person — anyone who moves out should be removed, rather than the
account being handed around.

That address is deliberately not written in this file. The repository is
public, and this one inbox is the recovery path for every other account, so it
does not belong somewhere it can be scraped. Whoever hands the site over to you
will tell you which address it is.

| What | Where | Used for | Cost |
|---|---|---|---|
| Ward email inbox | Gmail | Owns the other four; receives admin sign-in links | — |
| GitHub repository | github.com | The source code Vercel deploys from | Free |
| Supabase project | supabase.com | The database, sign-in, group photos | Free |
| Vercel project | vercel.com | Hosting and the daily keep-alive | Free (Hobby) |
| Google account + Calendar | google.com | The ward calendar — the source of every event on the site | Free |

If you can sign in to the ward email, you can recover everything else.

**"Owned by the ward email" means signed up as it, not invited to it.** There is
no collaborator to add: Vercel's free Hobby plan has no team members at all
(that is a paid feature), and a personal GitHub account has no shared ownership
either. Each account is created by signing up *with the ward's Google account*.
If any of them is created under a member's personal address instead, the ward
depends on that person for as long as it stays that way — which is the single
thing this whole design is trying to avoid.

### The permanent admin row

One row in the admin list is marked permanent and **cannot be deleted** — not
through the site, not through the API, not with the secret key. A database
trigger refuses it. That row is the ward email address, and it exists so that no
mistake and no departing admin can lock everyone out.

If you ever see "The ward email address cannot be removed from the admin list",
that is the guardrail doing its job.

---

## 2. First-time setup

Do these in order. Steps 1–4 are required; step 5 is optional and can happen
later without touching anything else.

### 0. Put the repository under the ward's GitHub account

Do this first — Vercel deploys from wherever the code lives, so getting it right
now avoids re-pointing the deployment later.

1. Sign up at github.com with the ward's Google account, if it does not exist.
2. From the current owner's account: repository → Settings → scroll to **Danger
   Zone** → **Transfer ownership** → enter the ward account's username.
3. Accept the transfer from the ward account's email.

The transfer keeps every commit, branch, and pull request, and GitHub redirects
the old URL — so nothing breaks. Whoever pushed last will need to update their
local remote:

```bash
git remote set-url origin git@github.com:WARD-ACCOUNT/ProvoYSA147WardApp.git
```

**Keep the repository public.** Vercel's free Hobby plan refuses to deploy a
commit whose author is not the Vercel account owner — but only for *private*
repositories. Since the people writing code will not be signed in as the ward,
a private repository blocks every deployment with:

> The deployment was blocked because the commit author did not have contributing
> access to the project on Vercel.

Public removes the restriction at no cost. There is nothing to hide here: the
site's security rests on row-level security and an email allowlist, not on the
source being secret. The alternative is Vercel Pro at $20/month, which breaks
the whole point of this build.

### 1. Create the Supabase project

Sign in to supabase.com **with the ward's Google account** and create a project. Note the
project's URL and its two API keys (Project Settings → API):

- the **publishable** key (`sb_publishable_…`) — safe in the browser
- the **secret** key (`sb_secret_…`) — server-only, never share it

Apply the database schema: with the Supabase CLI installed and the project
linked (`supabase link`), run `supabase db push`. That creates the tables, the
security rules, and the group-photo storage bucket.

**If `supabase db push` hangs at "Initialising login role…"**, your network is
blocking the Postgres port — common on campus and office networks. Confirm it
in a few seconds:

```bash
node -e 'const s=require("net").connect({host:"aws-1-us-west-2.pooler.supabase.com",port:5432,timeout:5000});s.on("connect",()=>{console.log("open");s.destroy()});s.on("timeout",()=>{console.log("blocked");s.destroy()});s.on("error",e=>console.log("blocked:",e.code))'
```

If it is blocked, paste `supabase/migrations/0001_schema.sql` into the
dashboard's SQL Editor instead — that goes over HTTPS. Afterwards, tell the CLI
the migration is already applied, so a later push does not try to re-run it:

```bash
npx supabase migration repair --status applied 0001
```

Also note: linking a hosted project needs Supabase CLI **2.114 or newer**.
Earlier versions fail with `LegacyLinkApiKeysNetworkError`.

### 2. Add the ward's permanent admin row

The database ships empty on purpose, so no placeholder address can become a
permanent admin. In the Supabase dashboard → SQL Editor, run this **once**,
with the ward's real address:

```sql
insert into public.admin_emails (email, is_permanent)
values ('THE-WARD-ADDRESS@example.com', true);
```

That address can now sign in at `/admin` and add everyone else.

### 3. Custom email sending — required

Supabase's built-in mailer allows **two emails per hour**. That is not enough
for sign-in links, so this is a launch prerequisite, not a nicety.

Send through the ward's own Gmail account. Transactional providers (Resend,
SendGrid, Mailjet) all want a **verified domain** before they will deliver to
arbitrary recipients, and this site deliberately has no custom domain — so they
would deliver to the ward's own address and to nobody else, which quietly breaks
adding any new admin. Gmail has no such restriction, sends genuinely *from* the
ward's address so the mail is domain-aligned and less likely to be filtered, and
adds no extra account to look after.

1. Turn on **2-Step Verification** for the ward's Google account
   (myaccount.google.com/security). App passwords do not exist without it.
2. Create an **App Password** at myaccount.google.com/apppasswords, named
   something like "Ward site". Copy the 16-character value — it is shown once.
3. In Supabase → Project Settings → Authentication → **SMTP Settings**, enable
   custom SMTP:

   | Field | Value |
   |---|---|
   | Sender email | the ward's address |
   | Sender name | `Provo YSA 147th Ward` |
   | Host | `smtp.gmail.com` |
   | Port | `465` |
   | Username | the ward's address |
   | Password | the 16-character app password |

4. Raise the send limit: Authentication → **Rate Limits** → *emails per hour*.
   It stays low until you change it, and a low limit is what makes sign-in look
   broken for no obvious reason.
5. In Authentication → Email Templates → **Magic Link**, replace the body with
   the contents of [`supabase/templates/magic-link.html`](../supabase/templates/magic-link.html).

Gmail allows roughly 500 messages a day against a real load of a few admin
sign-ins, so there is enormous headroom.

**If sign-in links stop arriving one day**, the likeliest cause is that somebody
changed the ward Google account's password — that revokes every app password.
Create a new one and update it in Supabase.

If you skip step 5 the site still works: `/auth/confirm` accepts both the custom
`token_hash` link and Supabase's stock one. The email just uses Supabase's
default wording rather than the ward's.

### 4. Configure and deploy on Vercel

Sign in to Vercel **with the ward's Google account** — in a logged-out window,
so you do not silently reuse a personal account — and import the repository from
the ward's GitHub account. Then set these environment variables (Project
Settings → Environment Variables):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The publishable key |
| `SUPABASE_SECRET_KEY` | The secret key |
| `CRON_SECRET` | Any long random string you invent |

Then, still in Vercel:

- If a rate-limit rule with the ID `event-submit` still exists under
  **Firewall**, delete it. It guarded the public suggestion form, which no
  longer exists.
- Confirm the daily cron appears under **Settings → Cron Jobs**. It comes from
  `vercel.json` and calls `/api/keepalive` once a day.
- **Settings → Deployment Protection → Vercel Authentication → Disabled.** If
  this is on, every visitor is redirected to a Vercel sign-in page and the site
  is effectively invisible. It is easy to miss because the deployment itself
  looks perfectly healthy.

Finally, back in Supabase → Authentication → URL Configuration:

- **Site URL**: your production URL, e.g. `https://provo-ysa-147.vercel.app`
- **Redirect URLs**: add `https://YOUR-URL/auth/confirm`

Sign-in links will not work until those two are right.

### 5. Google Calendar — required for events to appear

**Every event on the site comes from the ward's Google Calendar.** Without the
three variables below the site works — groups, quick links, admin — but the
events region says the calendar isn't loading.

1. Sign in to Google **as the ward account**. Create a calendar for the ward
   and note its Calendar ID (Calendar settings → Integrate calendar).
2. At console.cloud.google.com, create a project, enable the **Google Calendar
   API**, and create a **service account**. Create a JSON key for it and
   download it.
3. Back in Google Calendar → your ward calendar → Settings → *Share with
   specific people* → add the service account's email address with
   **"See all event details"**. Do not pick "See only free/busy" — that hides
   the titles, so the site would show blank events. The site only ever reads,
   so it does not need "Make changes".
4. In Vercel, add three more environment variables:

   | Variable | Where it comes from |
   |---|---|
   | `GOOGLE_SA_CLIENT_EMAIL` | `client_email` in the JSON key |
   | `GOOGLE_SA_PRIVATE_KEY` | `private_key` in the JSON key, newlines written as `\n` |
   | `GOOGLE_CALENDAR_ID` | The ward calendar's ID |

5. Redeploy and check the calendar page. Events appear within about five
   minutes of any change.

No domain-wide delegation is needed — sharing the calendar with the service
account is enough.

---

## 3. Running it day to day

### Managing events in Google Calendar

Add, edit, and delete events in the ward's Google Calendar. Nothing is approved
or entered on the site — there is no event screen there any more. The site
re-reads the calendar about every five minutes, so a change takes a few minutes
to show up.

What carries across: the title, the date and times, the location, and the
description. All-day events show as "All day", and repeating events are handled
by Google, including a single moved or cancelled occurrence.

**The colour you give an event decides its chip on the site:**

| Colour in Google Calendar | Chip on the site |
|---|---|
| Lavender, Grape (purples) | FHE |
| Peacock, Blueberry (blues) | Temple |
| Sage, Basil (greens) | Service |
| Flamingo, Banana, Tangerine, Tomato (warm) | Activity |
| Graphite, or no colour set | Activity |

There are only these four chips, so everything lands on one of them. An
uncoloured event is not broken — it is simply treated as an activity, which is
what most of them are. If a temple trip or an FHE is showing up as an activity,
it just needs its colour set in Google.

**The calendar is public.** Everything typed into an event — title, location,
description — appears on the public site, so keep phone numbers and private
notes out of event descriptions. Names are safe from a different angle: who
created an event and who was invited are never read by the site at all, and a
test enforces that.

The site shows roughly three months back and just over a year ahead. Anything
outside that window shows the normal empty state.

### Managing groups on the groups page

Sign in through the **Admin** link in the site footer. You land back on
`/groups`, and from then on every card there has **Edit** and **Delete** on it,
with an **Add group** button above the grid. Each opens the same small form —
name, description, emoji or photo, when and where, GroupMe link, and the order
they appear in.

Nobody signed out ever sees any of it; the page looks exactly as it always did.

### Changing the home page's fixed text

The welcome line, the optional Sunday meeting line, and the announcement banner
are constants at the top of `lib/site.ts`. Editing them is a code change and a
deploy — that is deliberate, since in practice they never change. An empty
`ANNOUNCEMENT` means no banner at all.

### Adding and removing admins

`/admin/admins`. Add someone by email and tell them to open the **Admin** link
in the footer and enter that exact address — there is no invitation to accept
and no password.

Removing **yourself** works and signs you out immediately. The ward's permanent
address has no Remove button at all.

---

## 4. When something is wrong

### "The site is down" / everything errors

The free Supabase project pauses after seven idle days. The daily cron exists to
prevent this, but if it happens: Supabase dashboard → your project → **Resume**.
It takes a couple of minutes. Then check that the cron is still listed in Vercel.

### Nobody can sign in

1. Is the address actually on the list? Sign in as the ward address, which can
   never be removed, and check `/admin/admins`.
2. Did the email arrive? Check the SMTP provider's dashboard for bounces or a
   hit rate limit.
3. Are the Supabase redirect URLs still right? They must match the deployed URL
   exactly (section 2, step 4).

Links work **once** and expire after an hour. A reused link shows a friendly
page with a button to send a fresh one.

### Events stopped appearing

The site shows "The calendar isn't loading right now" when it cannot read the
ward calendar. Everything else on the page keeps working, and it retries on the
next visit — a brief Google hiccup clears itself.

If it persists, work down this list:

1. Is the calendar still shared with the service account, at "See all event
   details" or better?
2. Has the service account key been revoked or expired? Redo section 2 step 5:
   create a new key, update the two Vercel variables, redeploy.
3. Are all three `GOOGLE_*` variables still set in Vercel, and is
   `GOOGLE_SA_PRIVATE_KEY` still intact (newlines written as `\n`)?

The deploy logs record the real reason — look for "Could not load the ward
Google Calendar".

---

## 5. For whoever maintains the code

### The four-layer admin gate — read this before changing auth

Admin access is enforced in **four** independent places. A change to who counts
as an admin must be mirrored in all four, or the layers disagree and the
weakest one wins:

1. `proxy.ts` — redirects signed-out visitors away from `/admin/*`. Convenience
   only. A proxy check can be bypassed with a crafted header
   (CVE-2025-29927), so nothing may depend on it alone.
2. `app/admin/(protected)/layout.tsx` — the authoritative check for admin
   *pages*. Anything that must be admin-only to look at belongs in that group.
3. `requireAdmin()` inside **every** admin server action. Actions are
   independently invocable POST endpoints; the form being admin-only says
   nothing about who can post to it. This is why the group actions can live
   outside the `(protected)` group, in `app/groups/actions.ts`, beside the
   public page whose forms submit to them — layer 2 never guarded an action,
   only a render. `checkAdmin()` on `/groups` decides what to draw and nothing
   more.
4. Row-level security in the database. The final boundary: a non-admin session
   cannot write anything even when calling the API directly.

`tests/db/rls.test.ts` proves layer 4 in both directions. If you change the
policies, that suite is what tells you whether you got it right.

### The calendar is public — and what the site refuses to read

Everything a leader types into a Google Calendar event reaches the public site.
What does *not* is anything about people: `lib/google/calendarEvents.ts` maps
only the title, colour, date, times, location, and description, and never
touches Google's `creator`, `organizer`, or `attendees` fields. A test asserts
that none of them can reach a `WardEvent`. That mapping is the privacy
boundary now, in the same way the `events_public` view was before the flip —
do not widen it.

### The flip to Google Calendar (done — kept for the record)

The site originally stored events in Supabase, took public suggestions, and
pushed approved events *to* Google. That is all gone. The order the changeover
had to happen in, in case anything like it is ever done again:

1. Confirm every future event already exists in the ward's Google Calendar —
   the old push sync had created most of them, but anything it had missed had
   to be entered by hand first.
2. Confirm the calendar is shared with the service account at "See all event
   details".
3. Deploy the read flip and check that events appear on `/` and `/calendar`.
4. Only then run `npx supabase db push` to apply
   `supabase/migrations/0002_drop_events.sql`, which drops the `events` table
   and its public view. That step is irreversible, which is why it is last.

### Release runbook for a destructive migration

Migrations 0002 and 0003 both drop a table the previously-deployed code reads.
The database and the deployed code are two systems that change separately, so
the order is not a detail — get it backwards and the live site errors until the
deploy lands. Any future drop follows the same five steps:

1. **Record anything the drop destroys that lives nowhere else.** For 0003 that
   is the `contact_*` columns; the migration's comment carries the query. Put
   what you find under "Who to ask" below, and commit it.
2. **Merge and deploy the code** that no longer reads the table.
3. **Confirm the deployed site works** — load the home page and `/groups` on
   the real URL, not just locally.
4. **Only now** run `npx supabase db push`.
5. **Reload the site again.** If step 4 broke something, this is where you find
   out, and rolling the deploy back is still the fastest fix.

Steps 2 and 4 are the whole point: the old code reads the table on every
home-page render, so pushing first turns the home page into a 500 until the
deploy catches up. `supabase db push` is irreversible — there is no undo.

### Who to ask

_Not yet recorded._ Whoever runs migration 0003 fills this in from the
production `site_settings` row before dropping it (step 1 above). Until then
the ward's own email address, which owns every account in section 1, is the
contact of record.

### Local development

See [`README.md`](../README.md).

**`vercel link` and `vercel env pull` overwrite `.env.local` with production
values.** That points local development at the ward's live database, where
`npm run test:db` and `npm run test:e2e` create and delete real users and rows.
If you run either Vercel command, restore `.env.local` to the local stack before
running any test suite. The file carries a comment saying so.

### Test suites

| Command | Covers |
|---|---|
| `npm run test` | Pure logic and components — dates, Google event mapping, UI |
| `npm run test:db` | The security model against a real database |
| `npm run test:e2e` | Whole flows in a browser — the turnover drill, and adding, editing, and deleting a group on `/groups` |

The last two need the local Supabase stack running.
