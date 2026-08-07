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

-- A spread of events: approved (public), pending (queue only), rejected
-- (invisible), a weekly series, and one that runs past midnight.
insert into public.events (
  status, title, category, event_date, start_time, end_time, location,
  description, repeats_weekly, repeat_until, submitter_name, submitter_contact
) values
  ('approved', 'Break the Fast', 'social', current_date + 2, '13:00', '15:00',
   'Ward building cultural hall', 'Bring a side if you can.', false, null,
   'Relief Society', 'rs@example.com'),
  ('approved', 'Institute Class', 'spiritual', current_date + 3, '19:00', '20:30',
   'Institute building, room 210', 'Doctrine and Covenants this semester.',
   true, (current_date + 90), 'Institute Council', 'institute@example.com'),
  ('approved', 'Volleyball', 'sports', current_date + 1, '20:00', '22:00',
   'Stake center gym', null, true, (current_date + 120), 'Activities', 'activities@example.com'),
  ('approved', 'Late-Night Game Night', 'social', current_date + 5, '21:30', '00:30',
   'Apartment 12 clubhouse', 'Runs past midnight — come whenever.', false, null,
   'Elders Quorum', 'eq@example.com'),
  ('approved', 'Canyon Service Project', 'service', current_date + 9, '09:00', null,
   'Rock Canyon trailhead', 'Gloves provided.', false, null,
   'Service Committee', 'service@example.com'),
  ('pending', 'Ultimate Frisbee', 'sports', current_date + 7, '18:00', '19:30',
   'Kiwanis Park', 'Thought this might be fun for the ward.', false, null,
   'Sam Taylor', 'sam.taylor@example.com'),
  ('pending', 'Sunday Evening Devotional', 'spiritual', current_date + 11, '19:00', '20:00',
   'Ward building chapel', null, false, null,
   'Jordan Reyes', '(801) 555-0182'),
  ('rejected', 'Off-Campus Party', 'social', current_date + 4, '22:00', '02:00',
   'Somewhere downtown', null, false, null,
   'Anonymous', 'anon@example.com');
