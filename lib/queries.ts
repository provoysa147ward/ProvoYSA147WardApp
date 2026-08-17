import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WardEvent } from "@/lib/events";
import {
  canReadCalendar,
  loadWardCalendarEvents,
} from "@/lib/google/calendarEvents";

/**
 * Every public read the site does.
 *
 * Groups and quick links come from Supabase. Events come from the ward's
 * Google Calendar instead — leaders manage them there — and that read is the
 * one allowed to fail quietly: a Supabase outage is a broken site, but a Google
 * outage must only empty the events region. The home page's fixed text is
 * neither: it is a set of constants in `lib/site.ts`.
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
