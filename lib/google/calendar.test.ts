import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pure parts of the Google push: id derivation, the RRULE, and the request
 * body. The network calls are exercised against a real test calendar during the
 * Phase 8 manual check — mocking googleapis here would prove nothing.
 */

// googleapis is heavy and irrelevant to these functions; stub it so the module
// imports cleanly under Vitest.
vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: class {} },
    calendar: () => ({ events: {} }),
  },
}));
vi.mock("server-only", () => ({}));

const {
  buildEventBody,
  buildRecurrenceRule,
  googleEventId,
  isSyncEnabled,
} = await import("@/lib/google/calendar");

const baseEvent = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  title: "Institute Class",
  location: "Institute building",
  description: null as string | null,
  eventDate: "2026-08-10",
  startTime: "19:00",
  endTime: "20:30" as string | null,
  repeatsWeekly: false,
  repeatUntil: null as string | null,
};

describe("googleEventId", () => {
  it("derives a stable id from the Supabase uuid", () => {
    expect(googleEventId(baseEvent.id)).toBe(
      "provo3f2504e04f8911d39a0c0305e82c3301",
    );
  });

  it("is deterministic, so a retry targets the same event", () => {
    expect(googleEventId(baseEvent.id)).toBe(googleEventId(baseEvent.id));
  });

  it("only ever emits characters Google accepts (base32hex)", () => {
    // Google rejects anything outside a-v and 0-9 — including the letters w-z,
    // which is why the prefix cannot spell "ysa".
    expect(googleEventId(baseEvent.id)).toMatch(/^[a-v0-9]+$/);
  });

  it("stays within Google's 5-1024 character bound", () => {
    const id = googleEventId(baseEvent.id);
    expect(id.length).toBeGreaterThanOrEqual(5);
    expect(id.length).toBeLessThanOrEqual(1024);
  });

  it("normalises an uppercase uuid to the same id", () => {
    expect(googleEventId(baseEvent.id.toUpperCase())).toBe(
      googleEventId(baseEvent.id),
    );
  });
});

describe("buildRecurrenceRule", () => {
  it("expresses UNTIL as a UTC timestamp, per RFC 5545", () => {
    // 7 PM on 28 September 2026 in Denver is 01:00Z the next day.
    expect(buildRecurrenceRule("19:00", "2026-09-28")).toBe(
      "RRULE:FREQ=WEEKLY;UNTIL=20260929T010000Z",
    );
  });

  it("uses the offset in force on the until-date, not today's", () => {
    // A series ending in January converts at UTC-7, not UTC-6.
    expect(buildRecurrenceRule("19:00", "2027-01-25")).toBe(
      "RRULE:FREQ=WEEKLY;UNTIL=20270126T020000Z",
    );
  });

  it("keeps the final occurrence inside the window", () => {
    // UNTIL is the series' own start time on the last date, so that occurrence
    // is included rather than cut off at midnight.
    const rule = buildRecurrenceRule("09:00", "2026-09-28");
    expect(rule).toBe("RRULE:FREQ=WEEKLY;UNTIL=20260928T150000Z");
  });
});

describe("buildEventBody", () => {
  it("sends local times with an explicit ward time zone, never UTC", () => {
    const body = buildEventBody(baseEvent);

    expect(body.start).toEqual({
      dateTime: "2026-08-10T19:00:00",
      timeZone: "America/Denver",
    });
    expect(body.end).toEqual({
      dateTime: "2026-08-10T20:30:00",
      timeZone: "America/Denver",
    });
  });

  it("carries the derived id, title, and location", () => {
    const body = buildEventBody(baseEvent);
    expect(body.id).toBe(googleEventId(baseEvent.id));
    expect(body.summary).toBe("Institute Class");
    expect(body.location).toBe("Institute building");
  });

  it("puts a past-midnight end on the following day", () => {
    const body = buildEventBody({
      ...baseEvent,
      startTime: "22:00",
      endTime: "00:30",
    });

    expect(body.start.dateTime).toBe("2026-08-10T22:00:00");
    expect(body.end.dateTime).toBe("2026-08-11T00:30:00");
  });

  it("gives an event with no end time a two-hour default", () => {
    const body = buildEventBody({ ...baseEvent, endTime: null });
    expect(body.end.dateTime).toBe("2026-08-10T21:00:00");
  });

  it("omits recurrence for a one-off", () => {
    expect(buildEventBody(baseEvent)).not.toHaveProperty("recurrence");
  });

  it("attaches an RRULE for a weekly series", () => {
    const body = buildEventBody({
      ...baseEvent,
      repeatsWeekly: true,
      repeatUntil: "2026-09-28",
    });

    expect(body.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;UNTIL=20260929T010000Z",
    ]);
  });

  it("omits recurrence when a series has no until-date", () => {
    const body = buildEventBody({
      ...baseEvent,
      repeatsWeekly: true,
      repeatUntil: null,
    });
    expect(body).not.toHaveProperty("recurrence");
  });

  it("normalises a Postgres time value with seconds", () => {
    const body = buildEventBody({
      ...baseEvent,
      startTime: "19:00:00",
      endTime: "20:30:00",
    });
    expect(body.start.dateTime).toBe("2026-08-10T19:00:00");
  });

  it("sends no description rather than an empty one", () => {
    expect(buildEventBody(baseEvent).description).toBeUndefined();
    expect(
      buildEventBody({ ...baseEvent, description: "Bring scriptures." })
        .description,
    ).toBe("Bring scriptures.");
  });
});

describe("isSyncEnabled", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.GOOGLE_SA_CLIENT_EMAIL;
    delete process.env.GOOGLE_SA_PRIVATE_KEY;
    delete process.env.GOOGLE_CALENDAR_ID;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("is off when no credentials are set", () => {
    expect(isSyncEnabled()).toBe(false);
  });

  it("stays off when only some credentials are set", () => {
    process.env.GOOGLE_SA_CLIENT_EMAIL = "sa@example.iam.gserviceaccount.com";
    expect(isSyncEnabled()).toBe(false);

    process.env.GOOGLE_SA_PRIVATE_KEY = "key";
    expect(isSyncEnabled()).toBe(false);
  });

  it("turns on only when all three are present", () => {
    process.env.GOOGLE_SA_CLIENT_EMAIL = "sa@example.iam.gserviceaccount.com";
    process.env.GOOGLE_SA_PRIVATE_KEY = "key";
    process.env.GOOGLE_CALENDAR_ID = "ward@group.calendar.google.com";
    expect(isSyncEnabled()).toBe(true);
  });
});
