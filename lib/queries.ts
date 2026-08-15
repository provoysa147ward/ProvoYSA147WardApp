import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WardEvent } from "@/lib/events";
import {
  canReadCalendar,
  loadWardCalendarEvents,
} from "@/lib/google/calendarEvents";
import type { IsoDate } from "@/lib/date";

/**
 * Every public read the site does.
 *
 * Groups, quick links, and settings come from Supabase. Events come from the
 * ward's Google Calendar instead — leaders manage them there — and that read
 * is the one allowed to fail quietly: a Supabase outage is a broken site, but
 * a Google outage must only empty the events region.
 */

export interface Group {
  id: string;
  name: string;
  description: string;
  emoji: string | null;
  photoUrl: string | null;
  meetingInfo: string;
  groupmeUrl: string | null;
  sortOrder: number;
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
}

export interface SiteSettings {
  welcomeBlurb: string;
  sundayMeetingInfo: string;
  announcement: string;
  announcementExpires: IsoDate | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export const EMPTY_SITE_SETTINGS: SiteSettings = {
  welcomeBlurb: "",
  sundayMeetingInfo: "",
  announcement: "",
  announcementExpires: null,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
};

export type CalendarEventsResult =
  | { ok: true; events: WardEvent[] }
  | { ok: false };

/**
 * The ward's events, or a plain "not right now".
 *
 * Missing credentials and a Google failure are the same thing to a visitor —
 * the events region says it is unavailable and everything else on the page
 * renders normally — so both come back as `ok: false` rather than throwing.
 */
export async function getCalendarEvents(): Promise<CalendarEventsResult> {
  if (!canReadCalendar()) return { ok: false };

  try {
    return { ok: true, events: await loadWardCalendarEvents() };
  } catch (error) {
    // Worth a line in the deploy logs: it is the one failure the site hides.
    console.error("Could not load the ward Google Calendar.", error);
    return { ok: false };
  }
}

export async function getGroups(): Promise<Group[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select(
      "id, name, description, emoji, photo_url, meeting_info, groupme_url, sort_order",
    )
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`Could not load groups: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    photoUrl: row.photo_url,
    meetingInfo: row.meeting_info,
    groupmeUrl: row.groupme_url,
    sortOrder: row.sort_order,
  }));
}

export async function getQuickLinks(): Promise<QuickLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quick_links")
    .select("id, label, url, sort_order")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(`Could not load quick links: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    url: row.url,
    sortOrder: row.sort_order,
  }));
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      "welcome_blurb, sunday_meeting_info, announcement, announcement_expires, contact_name, contact_email, contact_phone",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`Could not load site settings: ${error.message}`);
  if (!data) return EMPTY_SITE_SETTINGS;

  return {
    welcomeBlurb: data.welcome_blurb,
    sundayMeetingInfo: data.sunday_meeting_info,
    announcement: data.announcement,
    announcementExpires: data.announcement_expires,
    contactName: data.contact_name,
    contactEmail: data.contact_email,
    contactPhone: data.contact_phone,
  };
}
