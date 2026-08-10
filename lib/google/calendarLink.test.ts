import { describe, expect, it } from "vitest";

import { addToGoogleCalendarUrl } from "@/lib/google/calendarLink";

function params(url: string) {
  return new URL(url).searchParams;
}

const baseEvent = {
  title: "Break the Fast",
  location: "Cultural hall",
  description: null as string | null,
  date: "2026-08-09",
  startTime: "13:00",
  endTime: "15:00" as string | null,
};

describe("addToGoogleCalendarUrl", () => {
  it("builds a template link with the event's details", () => {
    const query = params(addToGoogleCalendarUrl(baseEvent));

    expect(query.get("action")).toBe("TEMPLATE");
    expect(query.get("text")).toBe("Break the Fast");
    expect(query.get("location")).toBe("Cultural hall");
    expect(query.get("ctz")).toBe("America/Denver");
  });

  it("converts the ward's local times to compact UTC", () => {
    // 1 PM Denver in August is UTC-6, so 19:00Z.
    const query = params(addToGoogleCalendarUrl(baseEvent));
    expect(query.get("dates")).toBe("20260809T190000Z/20260809T210000Z");
  });

  it("uses the standard-time offset in winter", () => {
    // 1 PM Denver in January is UTC-7, so 20:00Z.
    const query = params(
      addToGoogleCalendarUrl({ ...baseEvent, date: "2026-01-09" }),
    );
    expect(query.get("dates")).toBe("20260109T200000Z/20260109T220000Z");
  });

  it("carries a past-midnight end onto the next day", () => {
    const query = params(
      addToGoogleCalendarUrl({
        ...baseEvent,
        startTime: "21:30",
        endTime: "00:30",
      }),
    );
    expect(query.get("dates")).toBe("20260810T033000Z/20260810T063000Z");
  });

  it("gives an event with no end time a two-hour default", () => {
    const query = params(
      addToGoogleCalendarUrl({ ...baseEvent, endTime: null }),
    );
    expect(query.get("dates")).toBe("20260809T190000Z/20260809T210000Z");
  });

  it("includes a description only when there is one", () => {
    expect(params(addToGoogleCalendarUrl(baseEvent)).has("details")).toBe(false);
    expect(
      params(
        addToGoogleCalendarUrl({ ...baseEvent, description: "Bring a side." }),
      ).get("details"),
    ).toBe("Bring a side.");
  });

  it("escapes characters that would otherwise break the query string", () => {
    const url = addToGoogleCalendarUrl({
      ...baseEvent,
      title: "Volleyball & Pizza",
      location: "Gym #2, 100 N 100 E",
    });

    expect(params(url).get("text")).toBe("Volleyball & Pizza");
    expect(params(url).get("location")).toBe("Gym #2, 100 N 100 E");
  });
});
