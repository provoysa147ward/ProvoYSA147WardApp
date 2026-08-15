-- Local development seed. This file runs only against the Supabase CLI local
-- stack (`supabase start`) — it is never applied to production.
--
-- Production gets its permanent admin row from the one-time SQL in
-- docs/HANDOFF.md, using the ward's real email address rather than the
-- placeholders below.

insert into public.admin_emails (email, is_permanent) values
  ('ward-email@example.com', true),
  ('admin@example.com', false)
on conflict (email) do nothing;

update public.site_settings set
  welcome_blurb = 'We''re a Young Single Adult ward in Provo. Come as you are — there''s a spot for you at every one of these.',
  sunday_meeting_info = 'Sundays at 9:00 AM · 1234 N Canyon Rd, Provo',
  announcement = 'Ward temple night is this Thursday — meet in the foyer at 6:30 PM.',
  announcement_expires = (current_date + 14),
  contact_name = 'Ward Council',
  contact_email = 'ward-email@example.com',
  contact_phone = '(801) 555-0147'
where id = 1;

insert into public.groups (name, description, emoji, meeting_info, groupme_url, sort_order) values
  ('Volleyball', 'Pickup games every week. All skill levels — genuinely.', '🏐', 'Tuesdays 8:00 PM · Stake center gym', 'https://groupme.com/join_group/00000001', 1),
  ('Institute', 'Weeknight class and dinner beforehand.', '📖', 'Wednesdays 7:00 PM · Institute building', 'https://groupme.com/join_group/00000002', 2),
  ('Service', 'Monthly projects around Provo.', '🤝', 'Second Saturday mornings', null, 3),
  ('Hiking', 'Canyon trails while the weather holds.', '🥾', 'Saturdays, times vary', 'https://groupme.com/join_group/00000003', 4)
on conflict do nothing;

insert into public.quick_links (label, url, sort_order) values
  ('Ward Google Calendar', 'https://calendar.google.com/', 1),
  ('Bishopric Office Hours', 'https://example.com/office-hours', 2),
  ('Find the Building', 'https://maps.google.com/', 3)
on conflict do nothing;

-- Events are not seeded: they live in the ward's Google Calendar now, and
-- the end-to-end suite feeds the app a fixture calendar instead (see
-- playwright.config.ts).
