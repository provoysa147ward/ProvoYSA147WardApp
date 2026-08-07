import "server-only";

import { isEventCategory, DEFAULT_CATEGORY } from "@/lib/categories";
import type { IsoDate, IsoTime } from "@/lib/date";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the admin area, against the `events` base table rather than
 * `events_public` — admins are the only role RLS lets read it, and they need
 * the pending rows, the rejected ones, and the submitter's contact details.
 */

export type EventStatus = "pending" | "approved" | "rejected";
export type SyncStatus = "not_synced" | "synced" | "failed";

export interface AdminEvent {
  id: string;
  status: EventStatus;
  title: string;
  category: string;
  eventDate: IsoDate;
  startTime: IsoTime;
  endTime: IsoTime | null;
  location: string;
  description: string | null;
  repeatsWeekly: boolean;
  repeatUntil: IsoDate | null;
  submitterName: string;
  submitterContact: string;
  googleEventId: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
}

const COLUMNS =
  "id, status, title, category, event_date, start_time, end_time, location, description, repeats_weekly, repeat_until, submitter_name, submitter_contact, google_event_id, sync_status, created_at";

interface AdminEventRow {
  id: string;
  status: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string | null;
  location: string;
  description: string | null;
  repeats_weekly: boolean;
  repeat_until: string | null;
  submitter_name: string;
  submitter_contact: string;
  google_event_id: string | null;
  sync_status: string;
  created_at: string;
}

function toAdminEvent(row: AdminEventRow): AdminEvent {
  return {
    id: row.id,
    status: row.status as EventStatus,
    title: row.title,
    category: isEventCategory(row.category) ? row.category : DEFAULT_CATEGORY,
    eventDate: row.event_date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    description: row.description,
    repeatsWeekly: row.repeats_weekly,
    repeatUntil: row.repeat_until,
    submitterName: row.submitter_name,
    submitterContact: row.submitter_contact,
    googleEventId: row.google_event_id,
    syncStatus: row.sync_status as SyncStatus,
    createdAt: row.created_at,
  };
}

/** Oldest first: the queue is a to-do list, not a feed. */
export async function getPendingEvents(): Promise<AdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Could not load the queue: ${error.message}`);
  return (data ?? []).map((row) => toAdminEvent(row as AdminEventRow));
}

export async function getEventsByStatus(
  status: EventStatus,
): Promise<AdminEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("status", status)
    .order("event_date", { ascending: true });

  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data ?? []).map((row) => toAdminEvent(row as AdminEventRow));
}

export async function getEvent(id: string): Promise<AdminEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load that event: ${error.message}`);
  return data ? toAdminEvent(data as AdminEventRow) : null;
}

export interface SyncCounts {
  failed: number;
  notSynced: number;
}

/** How many approved events are not on the ward's Google Calendar. */
export async function getSyncCounts(): Promise<SyncCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("sync_status")
    .eq("status", "approved")
    .in("sync_status", ["failed", "not_synced"]);

  if (error) throw new Error(`Could not read sync status: ${error.message}`);

  const rows = data ?? [];
  return {
    failed: rows.filter((row) => row.sync_status === "failed").length,
    notSynced: rows.filter((row) => row.sync_status === "not_synced").length,
  };
}
