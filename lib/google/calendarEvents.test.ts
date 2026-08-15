import type { calendar_v3 } from "googleapis";
import { describe, expect, it, vi } from "vitest";

/**
 * The mapping is the whole risk surface of reading Google: everything else in
 * that module is a thin `events.list` call, which mocking would only prove the
 * mock right. So every awkward shape Google can hand back gets a fixture here.
 *
 * The ward is in America/Denver: UTC-6 in summer, UTC-7 in winter.
 */

// Same reasoning as `calendar.test.ts`: googleapis is heavy and irrelevant to
// the pure functions, and `server-only` refuses to load outside a server build.
vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: class {} },
    calendar: () => ({ events: {} }),
  },
}));
vi.mock("server-only", () => ({}));

const { fetchWindow, mapGoogleEvent } = await import(
  "@/lib/google/calendarEvents"
);

function timedEvent(
  overrides: Partial<calendar_v3.Schema$Event> = {},
): calendar_v3.Schema$Event {
  return {
    id: "event-1",
    status: "confirmed",
    summary: "Volleyball",
    location: "Stake center gym",
    description: "Bring water.",
    colorId: "2",
    start: { dateTime: "2026-08-19T20:00:00-06:00", timeZone: "America/Denver" },
    end: { dateTime: "2026-08-19T22:00:00-06:00", timeZone: "America/Denver" },
    ...overrides,
  };
}

describe("mapGoogleEvent", () => {
  it("maps a timed event to one ward event", () => {
    expect(mapGoogleEvent(timedEvent())).toEqual([
      {
        id: "event-1",
        title: "Volleyball",
        category: "sports",
        eventDate: "2026-08-19",
        startTime: "20:00",
        endTime: "22:00",
        location: "Stake center gym",
        description: "Bring water.",
        allDay: false,
      },
    ]);
  });

  it("converts an event created in another time zone to the ward's clock", () => {
    const [event] = mapGoogleEvent(
      timedEvent({
        start: { dateTime: "2026-08-20T00:30:00Z" },
        end: { dateTime: "2026-08-20T02:00:00Z" },
      }),
    );

    // 00:30 UTC on the 20th is 18:30 on the 19th in Denver.
    expect(event.eventDate).toBe("2026-08-19");
    expect(event.startTime).toBe("18:30");
    expect(event.endTime).toBe("20:00");
  });

  it("encodes an event running past midnight as an earlier end time", () => {
    const [event] = mapGoogleEvent(
      timedEvent({
        start: { dateTime: "2026-08-19T21:00:00-06:00" },
        end: { dateTime: "2026-08-20T00:30:00-06:00" },
      }),
    );

    expect(event.eventDate).toBe("2026-08-19");
    expect(event.startTime).toBe("21:00");
    expect(event.endTime).toBe("00:30");
  });

  it("drops an end time the site's encoding cannot express", () => {
    // Two days long: it renders on its start day with a start time only.
    const [event] = mapGoogleEvent(
      timedEvent({
        start: { dateTime: "2026-08-19T09:00:00-06:00" },
        end: { dateTime: "2026-08-21T17:00:00-06:00" },
      }),
    );

    expect(event.eventDate).toBe("2026-08-19");
    expect(event.endTime).toBeNull();
  });

  it("keeps a DST-boundary event on the wall-clock time Google reports", () => {
    // 2026 falls back on 1 November: 19:00 MDT the evening before, and 19:00
    // MST the evening after, are both 19:00 to the ward.
    const before = mapGoogleEvent(
      timedEvent({ start: { dateTime: "2026-10-31T19:00:00-06:00" }, end: undefined }),
    );
    const after = mapGoogleEvent(
      timedEvent({ start: { dateTime: "2026-11-01T19:00:00-07:00" }, end: undefined }),
    );

    expect(before[0].eventDate).toBe("2026-10-31");
    expect(before[0].startTime).toBe("19:00");
    expect(after[0].eventDate).toBe("2026-11-01");
    expect(after[0].startTime).toBe("19:00");
  });

  it("maps a single all-day event to one day", () => {
    const events = mapGoogleEvent(
      timedEvent({
        start: { date: "2026-08-19" },
        end: { date: "2026-08-20" },
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventDate: "2026-08-19",
      startTime: "00:00",
      endTime: null,
      allDay: true,
    });
  });

  it("spreads a multi-day all-day event over every day it covers", () => {
    // Google's all-day end date is exclusive, so this is the 19th to the 21st.
    const events = mapGoogleEvent(
      timedEvent({
        start: { date: "2026-08-19" },
        end: { date: "2026-08-22" },
      }),
    );

    expect(events.map((event) => event.eventDate)).toEqual([
      "2026-08-19",
      "2026-08-20",
      "2026-08-21",
    ]);
    // They share the Google id; the occurrence key is what makes each unique.
    expect(new Set(events.map((event) => event.id)).size).toBe(1);
    expect(events.every((event) => event.allDay)).toBe(true);
  });

  it("treats an all-day event with no end date as one day", () => {
    const events = mapGoogleEvent(
      timedEvent({ start: { date: "2026-08-19" }, end: undefined }),
    );

    expect(events.map((event) => event.eventDate)).toEqual(["2026-08-19"]);
  });

  it("drops a cancelled instance", () => {
    expect(mapGoogleEvent(timedEvent({ status: "cancelled" }))).toEqual([]);
  });

  it("drops an item with neither a date nor a dateTime", () => {
    expect(
      mapGoogleEvent(timedEvent({ start: undefined, end: undefined })),
    ).toEqual([]);
  });

  it("falls back to a placeholder title, and tolerates no location", () => {
    const [event] = mapGoogleEvent(
      timedEvent({ summary: "   ", location: null, description: null }),
    );

    expect(event.title).toBe("(No title)");
    expect(event.location).toBe("");
    expect(event.description).toBeNull();
  });

  it("renders an HTML description as plain text", () => {
    const [event] = mapGoogleEvent(
      timedEvent({
        description:
          '<p>Bring a side.</p><p>Questions? <a href="mailto:a@b.example">Ask</a> &amp; we&#39;ll help.</p>',
      }),
    );

    expect(event.description).toBe("Bring a side.\nQuestions? Ask & we'll help.");
  });

  it("keeps the line breaks a description's markup stood for", () => {
    const [event] = mapGoogleEvent(
      timedEvent({ description: "Line one<br>Line two<br><br><br>Line three" }),
    );

    expect(event.description).toBe("Line one\nLine two\n\nLine three");
  });

  it("maps every Google colour onto a chip, and no colour onto the default", () => {
    const categoryFor = (colorId: string | null) =>
      mapGoogleEvent(timedEvent({ colorId }))[0].category;

    expect(categoryFor("2")).toBe("sports");
    expect(categoryFor("10")).toBe("sports");
    expect(categoryFor("1")).toBe("spiritual");
    expect(categoryFor("3")).toBe("spiritual");
    expect(categoryFor("4")).toBe("social");
    expect(categoryFor("11")).toBe("social");
    expect(categoryFor("7")).toBe("service");
    expect(categoryFor("9")).toBe("service");
    expect(categoryFor("8")).toBe("other");
    expect(categoryFor(null)).toBe("other");
  });

  it("never surfaces who organised an event or who is coming", () => {
    // This mapping is the privacy boundary now — whatever Google knows about
    // people must not reach the public site.
    const [event] = mapGoogleEvent(
      timedEvent({
        creator: { email: "bishop@example.com", displayName: "Bishop" },
        organizer: { email: "ward@example.com", displayName: "Ward" },
        attendees: [
          { email: "riley@example.com", displayName: "Riley", responseStatus: "accepted" },
        ],
        hangoutLink: "https://meet.example/abc",
      }),
    );

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("example.com");
    expect(serialized).not.toContain("Riley");
    expect(Object.keys(event).sort()).toEqual([
      "allDay",
      "category",
      "description",
      "endTime",
      "eventDate",
      "id",
      "location",
      "startTime",
      "title",
    ]);
  });
});

describe("fetchWindow", () => {
  it("runs from three months back to the end of the thirteenth month ahead", () => {
    expect(fetchWindow("2026-08-14")).toEqual({
      from: "2026-05-01",
      to: "2027-10-01",
    });
  });

  it("crosses a year boundary in both directions", () => {
    expect(fetchWindow("2026-01-15")).toEqual({
      from: "2025-10-01",
      to: "2027-03-01",
    });
  });
});
