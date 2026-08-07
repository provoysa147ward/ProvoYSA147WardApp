-- Provo YSA 147th Ward website — schema, row-level security, and storage.
--
-- The security model in one paragraph: nothing reaches the public except
-- through `public.events_public`, a definer-rights view whose column list is
-- itself the privacy boundary. The `events` base table has no SELECT policy for
-- anyone but an admin, so submitter contact details and pending/rejected rows
-- have no API path out. Admin status is decided by `private.is_admin()` against
-- the `admin_emails` allowlist, and one row in that allowlist is marked
-- permanent so a mistake can never lock the ward out.

-- ---------------------------------------------------------------------------
-- Private schema: helpers that must never be reachable through the API.
-- ---------------------------------------------------------------------------

create schema if not exists private;

revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Production starts empty: the ward's own address is inserted once by hand at
-- setup (the runbook is in docs/HANDOFF.md) so no placeholder address can ever
-- become a permanent admin. supabase/seed.sql fills this in for local dev only.
create table public.admin_emails (
  email text primary key,
  -- The ward's own address. A trigger below refuses to delete this row, so no
  -- UI bug and no direct API call can remove the last way back in.
  is_permanent boolean not null default false,
  added_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  title text not null check (length(trim(title)) between 1 and 120),
  category text not null
    check (category in ('sports', 'spiritual', 'social', 'service', 'other')),
  event_date date not null,
  start_time time not null,
  -- Null when the submitter left it blank. A value earlier than start_time
  -- means the event runs past midnight; see lib/events.ts.
  end_time time,
  location text not null check (length(trim(location)) between 1 and 200),
  description text check (length(description) <= 2000),
  repeats_weekly boolean not null default false,
  repeat_until date,
  -- Admin-visible only: never selected by events_public.
  submitter_name text not null check (length(trim(submitter_name)) between 1 and 100),
  submitter_contact text not null check (length(trim(submitter_contact)) between 1 and 200),
  google_event_id text,
  sync_status text not null default 'not_synced'
    check (sync_status in ('not_synced', 'synced', 'failed')),
  created_at timestamptz not null default now(),

  constraint events_repeat_until_required_when_repeating
    check (not repeats_weekly or repeat_until is not null),
  constraint events_repeat_until_not_before_start
    check (repeat_until is null or repeat_until >= event_date),
  constraint events_repeat_until_within_one_year
    check (repeat_until is null or repeat_until <= (event_date + interval '1 year')::date)
);

create index events_approved_date_idx
  on public.events (event_date)
  where status = 'approved';

create index events_status_created_idx on public.events (status, created_at);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  description text not null check (length(trim(description)) between 1 and 1000),
  emoji text check (length(emoji) <= 8),
  photo_url text,
  meeting_info text not null default '' check (length(meeting_info) <= 200),
  groupme_url text check (groupme_url ~ '^https://'),
  sort_order integer not null default 0
);

create table public.quick_links (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(trim(label)) between 1 and 60),
  url text not null check (url ~ '^https://'),
  sort_order integer not null default 0
);

create table public.site_settings (
  -- Exactly one row, forever.
  id integer primary key default 1 check (id = 1),
  welcome_blurb text not null default '',
  sunday_meeting_info text not null default '',
  announcement text not null default '',
  announcement_expires date,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default ''
);

insert into public.site_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Email normalisation and the permanent-admin guard
-- ---------------------------------------------------------------------------

create or replace function private.normalize_admin_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger admin_emails_normalize_email
  before insert or update on public.admin_emails
  for each row execute function private.normalize_admin_email();

create or replace function private.prevent_permanent_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_permanent then
    raise exception 'The ward email address cannot be removed from the admin list.'
      using errcode = 'restrict_violation';
  end if;
  return old;
end;
$$;

create trigger admin_emails_prevent_permanent_delete
  before delete on public.admin_emails
  for each row execute function private.prevent_permanent_admin_delete();

-- The permanence flag is the recovery guarantee, so it must not be edited away.
create or replace function private.prevent_permanent_admin_downgrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_permanent and not new.is_permanent then
    raise exception 'The ward email address must remain a permanent admin.'
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger admin_emails_prevent_permanent_downgrade
  before update on public.admin_emails
  for each row execute function private.prevent_permanent_admin_downgrade();

-- ---------------------------------------------------------------------------
-- Admin check
--
-- security definer so it can read admin_emails without an RLS policy of its
-- own (which would recurse); `set search_path = ''` so every reference inside
-- must be schema-qualified and cannot be hijacked by a caller's search_path.
-- Policies wrap it as `(select private.is_admin())` so Postgres caches the
-- result once per statement instead of evaluating it per row.
-- ---------------------------------------------------------------------------

create or replace function private.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  claim_email text;
begin
  claim_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if claim_email = '' then
    return false;
  end if;
  return exists (
    select 1 from public.admin_emails where email = claim_email
  );
end;
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public read surface
--
-- A definer-rights view (security_invoker = false, stated explicitly so a
-- future default change cannot silently flip it). Because it runs as its owner
-- it bypasses the base table's RLS — which is exactly why the column list below
-- is the privacy boundary. Never add submitter_name, submitter_contact, or
-- status to this list.
-- ---------------------------------------------------------------------------

create view public.events_public
with (security_invoker = false) as
  select
    id,
    title,
    category,
    event_date,
    start_time,
    end_time,
    location,
    description,
    repeats_weekly,
    repeat_until
  from public.events
  where status = 'approved';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.groups enable row level security;
alter table public.quick_links enable row level security;
alter table public.site_settings enable row level security;
alter table public.admin_emails enable row level security;

-- events: anyone may suggest one, but only as a pending row. There is
-- deliberately no SELECT policy for non-admins — the view is the only way out.
create policy events_insert_pending on public.events
  for insert to anon, authenticated
  with check (status = 'pending');

create policy events_admin_all on public.events
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Public content: world-readable, admin-writable.
create policy groups_select_all on public.groups
  for select to anon, authenticated using (true);

create policy groups_admin_all on public.groups
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy quick_links_select_all on public.quick_links
  for select to anon, authenticated using (true);

create policy quick_links_admin_all on public.quick_links
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy site_settings_select_all on public.site_settings
  for select to anon, authenticated using (true);

create policy site_settings_admin_all on public.site_settings
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- The allowlist is admin-only in both directions.
create policy admin_emails_admin_all on public.admin_emails
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Grants
--
-- Supabase grants broadly to anon/authenticated by default, so every table is
-- revoked first and then granted exactly what the matrix above allows. Note
-- that `authenticated` covers admins and non-admins alike: the table grants are
-- necessarily broad and RLS is what separates the two.
-- ---------------------------------------------------------------------------

revoke all on public.events from anon, authenticated;
revoke all on public.groups from anon, authenticated;
revoke all on public.quick_links from anon, authenticated;
revoke all on public.site_settings from anon, authenticated;
revoke all on public.admin_emails from anon, authenticated;

-- anon may only insert a suggestion, and only the submission columns. Because
-- `status` is withheld, an anonymous attempt to file an already-approved event
-- is refused by the column grant before RLS is even consulted.
grant insert (
  title, category, event_date, start_time, end_time, location, description,
  repeats_weekly, repeat_until, submitter_name, submitter_contact
) on public.events to anon;

-- `authenticated` needs the whole table because admins live in that role and
-- must be able to write `status` and the sync columns. The column trick above
-- cannot be reused here, so for signed-in users RLS is the only thing standing
-- between a non-admin and an approved row — which is what
-- `events_insert_pending`'s `with check` enforces.
grant select, insert, update, delete on public.events to authenticated;

grant select on public.groups to anon, authenticated;
grant select on public.quick_links to anon, authenticated;
grant select on public.site_settings to anon, authenticated;

grant insert, update, delete on public.groups to authenticated;
grant insert, update, delete on public.quick_links to authenticated;
grant update on public.site_settings to authenticated;
grant select, insert, update, delete on public.admin_emails to authenticated;

-- The public read surface.
revoke all on public.events_public from anon, authenticated;
grant select on public.events_public to anon, authenticated;

-- service_role backs the secret-key client. It bypasses RLS, but table grants
-- are a separate mechanism and current Supabase defaults hand out no DML at
-- all, so they have to be stated.
grant all on public.events to service_role;
grant all on public.groups to service_role;
grant all on public.quick_links to service_role;
grant all on public.site_settings to service_role;
grant all on public.admin_emails to service_role;
grant select on public.events_public to service_role;

-- ---------------------------------------------------------------------------
-- Storage: group photos
--
-- The 2 MB cap and the image allowlist are enforced by the bucket itself, so no
-- client-side check can be bypassed.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-photos',
  'group-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy group_photos_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'group-photos');

create policy group_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'group-photos' and (select private.is_admin()));

create policy group_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'group-photos' and (select private.is_admin()))
  with check (bucket_id = 'group-photos' and (select private.is_admin()));

create policy group_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'group-photos' and (select private.is_admin()));
