# Handoff — Provo YSA 147th Ward website

This is the document that matters. The site is designed so a non-developer can
run it indefinitely, and so that nobody's personal account is load-bearing. If
you are inheriting it, read this end to end once — it should take about fifteen
minutes.

**The one rule:** everything on the site is edited **on the site**, at `/admin`.
You should never need to change code to change content.

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
| Google account + Calendar | google.com | The subscribable ward calendar (optional) | Free |

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

- **Firewall → New Rule**: create a rate-limit rule with the ID
  `event-submit`. Without it the submission form still works, it just isn't
  rate limited. This cannot be tested locally — check it on a preview
  deployment.
- Confirm the daily cron appears under **Settings → Cron Jobs**. It comes from
  `vercel.json` and calls `/api/keepalive` once a day.

Finally, back in Supabase → Authentication → URL Configuration:

- **Site URL**: your production URL, e.g. `https://provo-ysa-147.vercel.app`
- **Redirect URLs**: add `https://YOUR-URL/auth/confirm`

Sign-in links will not work until those two are right.

### 5. Google Calendar — optional, and safe to defer

The site works completely without this. Approved events simply queue as "not
synced" and every event still offers an **Add to Google Calendar** link that
works for visitors regardless.

When you're ready:

1. Sign in to Google **as the ward account**. Create a calendar for the ward
   and note its Calendar ID (Calendar settings → Integrate calendar).
2. At console.cloud.google.com, create a project, enable the **Google Calendar
   API**, and create a **service account**. Create a JSON key for it and
   download it.
3. Back in Google Calendar → your ward calendar → Settings → *Share with
   specific people* → add the service account's email address with
   **"Make changes to events"**.
4. In Vercel, add three more environment variables:

   | Variable | Where it comes from |
   |---|---|
   | `GOOGLE_SA_CLIENT_EMAIL` | `client_email` in the JSON key |
   | `GOOGLE_SA_PRIVATE_KEY` | `private_key` in the JSON key, newlines written as `\n` |
   | `GOOGLE_CALENDAR_ID` | The ward calendar's ID |

5. Redeploy, sign in at `/admin`, and press **Retry sync**. Everything approved
   so far is pushed at once.

No domain-wide delegation is needed — sharing the calendar with the service
account is enough.

---

## 3. Running it day to day

### Approving events

`/admin` shows everything waiting, oldest first. Open one, fix anything that
needs fixing, and press **Save and approve** — the edit and the approval happen
together, so a half-corrected version is never live.

**Reject** hides a suggestion everywhere public but keeps the record, so the
same thing doesn't come round again and you can still see who sent it.

### Repeating events, and skipping a week

A weekly event is one entry that repeats on the same weekday, up to a year out.
There is deliberately no way to cancel a single week. To skip one: end the
series before the gap, then add a second series that picks up after it. The
same note appears in the form itself, next to the repeat field.

### Adding and removing admins

`/admin/admins`. Add someone by email and tell them to go to `/admin` and enter
that exact address — there is no invitation to accept and no password.

Removing **yourself** works and signs you out immediately. The ward's permanent
address has no Remove button at all.

### The Google sync banner

If `/admin` shows that events didn't reach Google Calendar, press **Retry
sync**. That is the whole recovery procedure — there is no background retry, on
purpose. The site itself is never affected; only the Google copy is missing.

**Edit events on the site, never in Google Calendar.** The sync is one-way.
Changes made in Google are overwritten the next time that event is edited here.

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

### Google events stopped appearing

Service account keys can be revoked or expire. Redo section 2 step 5 — create a
new key, update the two Vercel variables, redeploy, press Retry sync. The site
carries on working throughout.

---

## 5. For whoever maintains the code

### The four-layer admin gate — read this before changing auth

Admin access is enforced in **four** independent places. A change to who counts
as an admin must be mirrored in all four, or the layers disagree and the
weakest one wins:

1. `proxy.ts` — redirects signed-out visitors away from `/admin/*`. Convenience
   only. A proxy check can be bypassed with a crafted header
   (CVE-2025-29927), so nothing may depend on it alone.
2. `app/admin/(protected)/layout.tsx` — the authoritative page-level check.
   Anything that must be admin-only belongs inside that route group.
3. `requireAdmin()` inside **every** admin server action. Actions are
   independently invocable POST endpoints; the form being admin-only says
   nothing about who can post to it.
4. Row-level security in the database. The final boundary: a non-admin session
   cannot write anything even when calling the API directly.

`tests/db/rls.test.ts` proves layer 4 in both directions. If you change the
policies, that suite is what tells you whether you got it right.

### Submitter privacy

The public site reads events through the `events_public` view, never the
`events` table. That view's column list *is* the privacy boundary — it omits
`submitter_name`, `submitter_contact`, and `status`. Never add them, and never
repoint a public query at the base table.

### Local development

See [`README.md`](../README.md).

### Test suites

| Command | Covers |
|---|---|
| `npm run test` | Pure logic and components — dates, recurrence, validation, UI |
| `npm run test:db` | The security model against a real database |
| `npm run test:e2e` | Whole flows in a browser, including the turnover drill |

The last two need the local Supabase stack running.
