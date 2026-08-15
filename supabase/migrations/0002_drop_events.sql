-- Events moved to the ward's Google Calendar.
--
-- The site reads them from there now (lib/google/calendarEvents.ts), so nothing
-- in the app touches these objects any more: no suggestion form, no approval
-- queue, no admin event screens, and no push sync. The privacy boundary they
-- carried — the `events_public` view's column list, which kept submitter
-- contact details off the public site — is replaced by the mapping layer, which
-- never reads Google's organizer or attendee fields.
--
-- Run this LAST, after the deployed site is confirmed to be reading Google:
-- it is the one irreversible step of the flip. Every future event must already
-- exist in the ward calendar before this runs.
--
-- The view goes first — it depends on the table — and the policies, grants,
-- indexes, and constraints go with the table itself.

drop view if exists public.events_public;
drop table if exists public.events;
