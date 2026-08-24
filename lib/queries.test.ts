import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WardEvent } from "@/lib/events";

/**
 * The failure-isolation contract, which is the whole reason `getCalendarEvents`
 * returns a result instead of throwing: a Google outage must empty the events
 * region and leave the rest of the page — announcements, groups, links, admin —
 * working. Every other read on the site is allowed to take the page down; this
 * one is not.
 */

const canReadCalendar = vi.fn();
const loadWardCalendarEvents = vi.fn();

vi.mock("server-only", () => ({}));
// Pages reach Supabase through this; nothing here exercises it.
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/google/calendarEvents", () => ({
  canReadCalendar,
  loadWardCalendarEvents,
}));

const { getCalendarEvents } = await import("@/lib/queries");

const EVENT: WardEvent = {
  id: "event-1",
  title: "Volleyball",
  category: "activity",
  eventDate: "2026-08-19",
  startTime: "20:00",
  endTime: "22:00",
  location: "Stake center gym",
  description: null,
  allDay: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Nothing here should surface a stack trace in the test output.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCalendarEvents", () => {
  it("returns the events when the calendar can be read", async () => {
    canReadCalendar.mockReturnValue(true);
    loadWardCalendarEvents.mockResolvedValue([EVENT]);

    await expect(getCalendarEvents()).resolves.toEqual({
      ok: true,
      events: [EVENT],
    });
  });

  it("reports failure rather than throwing when the calendar is unreadable", async () => {
    canReadCalendar.mockReturnValue(true);
    loadWardCalendarEvents.mockRejectedValue(new Error("Google is down"));

    await expect(getCalendarEvents()).resolves.toEqual({ ok: false });
  });

  it("logs the real reason so a deploy log can explain an empty calendar", async () => {
    canReadCalendar.mockReturnValue(true);
    loadWardCalendarEvents.mockRejectedValue(new Error("Google is down"));

    await getCalendarEvents();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Could not load the ward Google Calendar."),
      expect.any(Error),
    );
  });

  it("reports failure without calling Google when there is nothing to read with", async () => {
    canReadCalendar.mockReturnValue(false);

    await expect(getCalendarEvents()).resolves.toEqual({ ok: false });
    expect(loadWardCalendarEvents).not.toHaveBeenCalled();
  });

  it("returns an empty list, not a failure, for a calendar with no events", async () => {
    canReadCalendar.mockReturnValue(true);
    loadWardCalendarEvents.mockResolvedValue([]);

    // The distinction matters: one says "nothing is scheduled", the other says
    // "the calendar isn't loading". They are different messages on the page.
    await expect(getCalendarEvents()).resolves.toEqual({ ok: true, events: [] });
  });
});
