-- The home page's fixed text moved into the code.
--
-- Welcome blurb, Sunday meeting line, and announcement banner are constants in
-- `lib/site.ts` now; the `contact_*` columns are simply gone, because they
-- rendered nowhere public and docs/HANDOFF.md already records who to ask. The
-- admin screen that edited this row went with it — in a year nobody ever used
-- it, and text that changes once a year does not need a database table, an RLS
-- policy, and a form to maintain.
--
-- Run this AFTER the new code is deployed and confirmed, not before: the old
-- code reads this table on every home-page render, so dropping it first turns
-- the home page into a 500. Same order as the 0002 flip.
--
-- The policies, grants, and the single-row constraint go with the table.

drop table if exists public.site_settings;
