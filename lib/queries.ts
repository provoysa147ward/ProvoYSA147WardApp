import { createClient } from "@/lib/supabase/server";
import { isEventCategory, DEFAULT_CATEGORY } from "@/lib/categories";
import type { WardEvent } from "@/lib/events";
import type { IsoDate } from "@/lib/date";

/**
 * Every public read the site does.
 *
 * Events come from `events_public`, never the base table — that view's column
 * list is what keeps submitter contact details off the public site, so nothing
 * here should ever be repointed at `events`.
 */

/** The shape `events_public` exposes. Deliberately has no submitter columns. */
interface EventPublicRow {
  id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  description: string | null;
  repeats_weekly: boolean;
  repeat_until: string | null;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  emoji: string | null;
  photoUrl: string | null;
  meetingInfo: string;
  groupmeUrl: string | null;
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
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

function toWardEvent(row: EventPublicRow): WardEvent {
  return {
    id: row.id,
    title: row.title,
    category: isEventCategory(row.category) ? row.category : DEFAULT_CATEGORY,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    description: row.description,
    repeatsWeekly: row.repeats_weekly,
    repeatUntil: row.repeat_until,
  };
}

/**
 * Every approved event, as stored rows rather than occurrences — a weekly
 * series is one row, and `lib/events.ts` expands it for whichever window the
 * caller is rendering.
 */
export async function getPublicEvents(): Promise<WardEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events_public")
    .select(
      "id, title, category, event_date, start_time, end_time, location, description, repeats_weekly, repeat_until",
    )
    .order("event_date", { ascending: true });

  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data ?? []).map((row) => toWardEvent(row as EventPublicRow));
}

export async function getGroups(): Promise<Group[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, description, emoji, photo_url, meeting_info, groupme_url")
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
  }));
}

export async function getQuickLinks(): Promise<QuickLink[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quick_links")
    .select("id, label, url")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) throw new Error(`Could not load quick links: ${error.message}`);
  return data ?? [];
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
