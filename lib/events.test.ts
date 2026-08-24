import { describe, expect, it } from "vitest";

import { toUtcIso, wardInstant } from "@/lib/date";
import {
  occurrencesInRange,
  upcomingOccurrences,
  type WardEvent,
} from "@/lib/events";

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Family Home Evening",
    category: "activity",
    eventDate: "2026-08-10",
    startTime: "19:00",
    endTime: "21:00",
    location: "Ward building",
    description: null,
    allDay: false,
    ...overrides,
  };
}

const dates = (occurrences: { date: string }[]) =>
  occurrences.map((occurrence) => occurrence.date);

const AUGUST = { from: "2026-08-01", to: "2026-08-31" };

describe("occurrencesInRange", () => {
  it("resolves an event to an occurrence with real instants", () => {
    const event = makeEvent();
    const [occurrence] = occurrencesInRange([event], AUGUST);

    expect(occurrence.date).toBe("2026-08-10");
    expect(occurrence.key).toBe("event-1@2026-08-10");
    expect(occurrence.event).toBe(event);
    expect(toUtcIso(occurrence.start)).toBe("2026-08-11T01:00:00.000Z");
    expect(toUtcIso(occurrence.end)).toBe("2026-08-11T03:00:00.000Z");
    expect(occurrence.endsNextDay).toBe(false);
  });

  it("includes events on the range boundaries and excludes those outside", () => {
    const range = { from: "2026-08-10", to: "2026-08-12" };
    const on = (eventDate: string) =>
      occurrencesInRange([makeEvent({ eventDate })], range);

    expect(on("2026-08-10")).toHaveLength(1);
    expect(on("2026-08-12")).toHaveLength(1);
    expect(on("2026-08-09")).toHaveLength(0);
    expect(on("2026-08-13")).toHaveLength(0);
  });

  it("takes everything from the start date when the range has no end", () => {
    const events = [
      makeEvent({ id: "past", eventDate: "2026-08-09" }),
      makeEvent({ id: "soon", eventDate: "2026-08-11" }),
      makeEvent({ id: "far", eventDate: "2027-05-04" }),
    ];

    expect(
      occurrencesInRange(events, { from: "2026-08-10" }).map((o) => o.event.id),
    ).toEqual(["soon", "far"]);
  });

  it("returns nothing for an inverted range", () => {
    expect(
      occurrencesInRange([makeEvent()], { from: "2026-08-31", to: "2026-08-01" }),
    ).toEqual([]);
  });

  it("returns nothing when there are no events", () => {
    expect(occurrencesInRange([], AUGUST)).toEqual([]);
  });

  it("orders occurrences chronologically", () => {
    const occurrences = occurrencesInRange(
      [
        makeEvent({ id: "c", eventDate: "2026-08-15", startTime: "09:00" }),
        makeEvent({ id: "a", eventDate: "2026-08-11", startTime: "19:00" }),
        makeEvent({ id: "b", eventDate: "2026-08-11", startTime: "21:00" }),
      ],
      AUGUST,
    );

    expect(occurrences.map((o) => o.event.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks same-instant ties by title", () => {
    const shared = { eventDate: "2026-08-10", startTime: "19:00" };
    const occurrences = occurrencesInRange(
      [
        makeEvent({ id: "b", title: "Volleyball", ...shared }),
        makeEvent({ id: "a", title: "Break the Fast", ...shared }),
      ],
      AUGUST,
    );

    expect(occurrences.map((o) => o.event.title)).toEqual([
      "Break the Fast",
      "Volleyball",
    ]);
  });

  it("keeps the occurrences of a multi-day event distinct", () => {
    // An all-day event covering three days arrives as three events sharing
    // one Google id; the key is what tells them apart.
    const allDay = (eventDate: string) =>
      makeEvent({
        id: "shared-id",
        eventDate,
        startTime: "00:00",
        endTime: null,
        allDay: true,
      });

    const occurrences = occurrencesInRange(
      ["2026-08-10", "2026-08-11", "2026-08-12"].map(allDay),
      AUGUST,
    );

    expect(occurrences.map((o) => o.key)).toEqual([
      "shared-id@2026-08-10",
      "shared-id@2026-08-11",
      "shared-id@2026-08-12",
    ]);
  });
});

describe("occurrencesInRange — end instants", () => {
  it("puts a past-midnight end on the following calendar day", () => {
    const [occurrence] = occurrencesInRange(
      [makeEvent({ startTime: "21:00", endTime: "00:30" })],
      AUGUST,
    );

    expect(occurrence.date).toBe("2026-08-10");
    expect(occurrence.endsNextDay).toBe(true);
    expect(toUtcIso(occurrence.start)).toBe("2026-08-11T03:00:00.000Z");
    expect(toUtcIso(occurrence.end)).toBe("2026-08-11T06:30:00.000Z");
    expect(occurrence.end.getTime()).toBeGreaterThan(occurrence.start.getTime());
  });

  it("runs an event with no end time to the end of its day", () => {
    const [occurrence] = occurrencesInRange(
      [makeEvent({ endTime: null })],
      AUGUST,
    );

    expect(occurrence.endsNextDay).toBe(false);
    expect(occurrence.end).toEqual(wardInstant("2026-08-11", "00:00"));
  });

  it("runs an all-day event from midnight to midnight", () => {
    const [occurrence] = occurrencesInRange(
      [makeEvent({ startTime: "00:00", endTime: null, allDay: true })],
      AUGUST,
    );

    expect(occurrence.start).toEqual(wardInstant("2026-08-10", "00:00"));
    expect(occurrence.end).toEqual(wardInstant("2026-08-11", "00:00"));
  });
});

describe("occurrencesInRange — DST", () => {
  it("holds 7 PM at 7 PM on either side of fall-back", () => {
    const occurrences = occurrencesInRange(
      [
        makeEvent({ id: "before", eventDate: "2026-10-25" }),
        makeEvent({ id: "after", eventDate: "2026-11-01" }),
      ],
      { from: "2026-10-01", to: "2026-11-30" },
    );

    for (const occurrence of occurrences) {
      expect(occurrence.start.getHours()).toBe(19);
      expect(occurrence.end.getHours()).toBe(21);
    }
    // The offset really does change between them — the wall clock is what held.
    expect(toUtcIso(occurrences[0].start)).toBe("2026-10-26T01:00:00.000Z");
    expect(toUtcIso(occurrences[1].start)).toBe("2026-11-02T02:00:00.000Z");
  });

  it("holds 7 PM at 7 PM on either side of spring-forward", () => {
    const occurrences = occurrencesInRange(
      [
        makeEvent({ id: "before", eventDate: "2026-03-01" }),
        makeEvent({ id: "after", eventDate: "2026-03-08" }),
      ],
      { from: "2026-02-01", to: "2026-03-31" },
    );

    for (const occurrence of occurrences) {
      expect(occurrence.start.getHours()).toBe(19);
    }
    expect(toUtcIso(occurrences[0].start)).toBe("2026-03-02T02:00:00.000Z");
    expect(toUtcIso(occurrences[1].start)).toBe("2026-03-09T01:00:00.000Z");
  });

  it("keeps a past-midnight event ending at the same wall clock across fall-back", () => {
    const occurrences = occurrencesInRange(
      [
        makeEvent({ id: "before", eventDate: "2026-10-25", startTime: "22:00", endTime: "00:30" }),
        makeEvent({ id: "after", eventDate: "2026-11-01", startTime: "22:00", endTime: "00:30" }),
      ],
      { from: "2026-10-01", to: "2026-11-30" },
    );

    expect(occurrences).toHaveLength(2);
    for (const occurrence of occurrences) {
      expect(occurrence.endsNextDay).toBe(true);
      expect(occurrence.start.getHours()).toBe(22);
      expect(occurrence.end.getHours()).toBe(0);
      expect(occurrence.end.getMinutes()).toBe(30);
    }
  });
});

describe("upcomingOccurrences", () => {
  // 2026-08-10T02:00:00Z is 8 PM Denver on 9 August.
  const eveningOfTheNinth = new Date("2026-08-10T02:00:00Z");

  it("keeps an event that has started but not finished", () => {
    const inProgress = makeEvent({
      eventDate: "2026-08-09",
      startTime: "19:00",
      endTime: "21:00",
    });

    expect(
      upcomingOccurrences([inProgress], { now: eveningOfTheNinth }),
    ).toHaveLength(1);
  });

  it("drops an event that has already ended", () => {
    const finished = makeEvent({
      eventDate: "2026-08-09",
      startTime: "17:00",
      endTime: "19:00",
    });

    expect(
      upcomingOccurrences([finished], { now: eveningOfTheNinth }),
    ).toEqual([]);
  });

  it("drops events from earlier days but keeps later ones", () => {
    const events = [
      makeEvent({ id: "yesterday", eventDate: "2026-08-08" }),
      makeEvent({ id: "tomorrow", eventDate: "2026-08-10" }),
    ];

    expect(
      upcomingOccurrences(events, { now: eveningOfTheNinth }).map(
        (o) => o.event.id,
      ),
    ).toEqual(["tomorrow"]);
  });

  it("keeps a still-running past-midnight event from the previous evening", () => {
    // 07:00Z on the 10th is 1 AM Denver — the event runs until 1:30 AM.
    const lateNight = makeEvent({
      eventDate: "2026-08-09",
      startTime: "22:00",
      endTime: "01:30",
    });

    expect(
      upcomingOccurrences([lateNight], {
        now: new Date("2026-08-10T07:00:00Z"),
      }),
    ).toHaveLength(1);
  });

  it("returns only the next `limit` occurrences, soonest first", () => {
    const events = [
      makeEvent({ id: "a", eventDate: "2026-08-10" }),
      makeEvent({ id: "b", eventDate: "2026-08-17" }),
      makeEvent({ id: "c", eventDate: "2026-08-24" }),
      makeEvent({ id: "d", eventDate: "2026-08-31" }),
    ];

    expect(
      dates(upcomingOccurrences(events, { now: eveningOfTheNinth, limit: 3 })),
    ).toEqual(["2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("stops at the end of the requested window", () => {
    const events = [
      makeEvent({ id: "today", eventDate: "2026-08-09" }),
      makeEvent({ id: "in-a-week", eventDate: "2026-08-16" }),
      makeEvent({ id: "just-past", eventDate: "2026-08-17" }),
      makeEvent({ id: "next-month", eventDate: "2026-09-20" }),
    ];

    expect(
      upcomingOccurrences(events, {
        now: eveningOfTheNinth,
        withinDays: 7,
      }).map((o) => o.event.id),
    ).toEqual(["today", "in-a-week"]);
  });

  it("still drops a finished event inside the window", () => {
    const finished = makeEvent({
      eventDate: "2026-08-09",
      startTime: "17:00",
      endTime: "19:00",
    });

    expect(
      upcomingOccurrences([finished], {
        now: eveningOfTheNinth,
        withinDays: 7,
      }),
    ).toEqual([]);
  });

  it("has no far horizon of its own — the fetch window is the only bound", () => {
    const distant = makeEvent({ id: "distant", eventDate: "2027-08-09" });

    expect(
      upcomingOccurrences([distant], { now: eveningOfTheNinth }),
    ).toHaveLength(1);
  });

  it("returns nothing when every event is in the past", () => {
    expect(
      upcomingOccurrences([makeEvent({ eventDate: "2020-01-01" })], {
        now: eveningOfTheNinth,
      }),
    ).toEqual([]);
  });
});
