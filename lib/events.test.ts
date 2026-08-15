import { describe, expect, it } from "vitest";

import { toUtcIso, wardInstant } from "@/lib/date";
import {
  expandEvent,
  expandEvents,
  upcomingOccurrences,
  type WardEvent,
} from "@/lib/events";

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Family Home Evening",
    category: "social",
    eventDate: "2026-08-10",
    startTime: "19:00",
    endTime: "21:00",
    location: "Ward building",
    description: null,
    allDay: false,
    repeatsWeekly: false,
    repeatUntil: null,
    ...overrides,
  };
}

const dates = (occurrences: { date: string }[]) =>
  occurrences.map((occurrence) => occurrence.date);

describe("expandEvent — single events", () => {
  it("yields one occurrence when the date is inside the range", () => {
    const event = makeEvent();
    const [occurrence] = expandEvent(event, {
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(occurrence.date).toBe("2026-08-10");
    expect(occurrence.key).toBe("event-1@2026-08-10");
    expect(occurrence.event).toBe(event);
    expect(toUtcIso(occurrence.start)).toBe("2026-08-11T01:00:00.000Z");
    expect(toUtcIso(occurrence.end)).toBe("2026-08-11T03:00:00.000Z");
    expect(occurrence.endsNextDay).toBe(false);
  });

  it("includes events on the range boundaries and excludes those outside", () => {
    const range = { from: "2026-08-10", to: "2026-08-12" };

    expect(expandEvent(makeEvent({ eventDate: "2026-08-10" }), range)).toHaveLength(1);
    expect(expandEvent(makeEvent({ eventDate: "2026-08-12" }), range)).toHaveLength(1);
    expect(expandEvent(makeEvent({ eventDate: "2026-08-09" }), range)).toHaveLength(0);
    expect(expandEvent(makeEvent({ eventDate: "2026-08-13" }), range)).toHaveLength(0);
  });

  it("returns nothing for an inverted range", () => {
    expect(
      expandEvent(makeEvent(), { from: "2026-08-31", to: "2026-08-01" }),
    ).toEqual([]);
  });
});

describe("expandEvent — past-midnight end times", () => {
  it("puts the end instant on the following calendar day", () => {
    const [occurrence] = expandEvent(
      makeEvent({ startTime: "21:00", endTime: "00:30" }),
      { from: "2026-08-01", to: "2026-08-31" },
    );

    expect(occurrence.date).toBe("2026-08-10");
    expect(occurrence.endsNextDay).toBe(true);
    expect(toUtcIso(occurrence.start)).toBe("2026-08-11T03:00:00.000Z");
    expect(toUtcIso(occurrence.end)).toBe("2026-08-11T06:30:00.000Z");
    expect(occurrence.end.getTime()).toBeGreaterThan(occurrence.start.getTime());
  });

  it("runs an event with no end time to the end of its day", () => {
    const [occurrence] = expandEvent(makeEvent({ endTime: null }), {
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(occurrence.endsNextDay).toBe(false);
    expect(occurrence.end).toEqual(wardInstant("2026-08-11", "00:00"));
  });
});

describe("expandEvent — weekly recurrence", () => {
  const weekly = makeEvent({
    repeatsWeekly: true,
    eventDate: "2026-08-10",
    repeatUntil: "2026-08-31",
  });

  it("repeats on the same weekday until the until-date", () => {
    const occurrences = expandEvent(weekly, {
      from: "2026-08-01",
      to: "2026-09-30",
    });

    expect(dates(occurrences)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("treats the until-date as inclusive when an occurrence lands on it", () => {
    const occurrences = expandEvent(
      { ...weekly, repeatUntil: "2026-08-24" },
      { from: "2026-08-01", to: "2026-09-30" },
    );

    expect(dates(occurrences)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ]);
  });

  it("stops before an occurrence that falls after the until-date", () => {
    const occurrences = expandEvent(
      { ...weekly, repeatUntil: "2026-08-23" },
      { from: "2026-08-01", to: "2026-09-30" },
    );

    expect(dates(occurrences)).toEqual(["2026-08-10", "2026-08-17"]);
  });

  it("clips to the requested range at both ends", () => {
    const occurrences = expandEvent(
      { ...weekly, repeatUntil: "2026-09-30" },
      { from: "2026-08-18", to: "2026-09-01" },
    );

    expect(dates(occurrences)).toEqual([
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("starts on the range's first day when an occurrence lands exactly there", () => {
    const occurrences = expandEvent(
      { ...weekly, repeatUntil: "2026-09-30" },
      { from: "2026-08-17", to: "2026-08-25" },
    );

    expect(dates(occurrences)).toEqual(["2026-08-17", "2026-08-24"]);
  });

  it("terminates at the range when the until-date is missing", () => {
    const occurrences = expandEvent(
      { ...weekly, repeatUntil: null },
      { from: "2026-08-01", to: "2026-08-31" },
    );

    expect(dates(occurrences)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });
});

describe("expandEvent — DST correctness of a weekly series", () => {
  it("holds a 7 PM series at 7 PM across fall-back", () => {
    const occurrences = expandEvent(
      makeEvent({
        eventDate: "2026-10-18",
        startTime: "19:00",
        endTime: "21:00",
        repeatsWeekly: true,
        repeatUntil: "2026-11-15",
      }),
      { from: "2026-10-01", to: "2026-11-30" },
    );

    expect(dates(occurrences)).toEqual([
      "2026-10-18",
      "2026-10-25",
      "2026-11-01",
      "2026-11-08",
      "2026-11-15",
    ]);
    for (const occurrence of occurrences) {
      expect(occurrence.start.getHours()).toBe(19);
      expect(occurrence.end.getHours()).toBe(21);
    }
    // The offset really does change mid-series — the wall clock is what held.
    expect(toUtcIso(occurrences[1].start)).toBe("2026-10-26T01:00:00.000Z");
    expect(toUtcIso(occurrences[2].start)).toBe("2026-11-02T02:00:00.000Z");
  });

  it("holds a 7 PM series at 7 PM across spring-forward", () => {
    const occurrences = expandEvent(
      makeEvent({
        eventDate: "2026-02-22",
        startTime: "19:00",
        endTime: "21:00",
        repeatsWeekly: true,
        repeatUntil: "2026-03-22",
      }),
      { from: "2026-02-01", to: "2026-03-31" },
    );

    expect(dates(occurrences)).toEqual([
      "2026-02-22",
      "2026-03-01",
      "2026-03-08",
      "2026-03-15",
      "2026-03-22",
    ]);
    for (const occurrence of occurrences) {
      expect(occurrence.start.getHours()).toBe(19);
    }
    expect(toUtcIso(occurrences[1].start)).toBe("2026-03-02T02:00:00.000Z");
    expect(toUtcIso(occurrences[2].start)).toBe("2026-03-09T01:00:00.000Z");
  });

  it("keeps a past-midnight series ending at the same wall clock across fall-back", () => {
    const occurrences = expandEvent(
      makeEvent({
        eventDate: "2026-10-25",
        startTime: "22:00",
        endTime: "00:30",
        repeatsWeekly: true,
        repeatUntil: "2026-11-01",
      }),
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

describe("expandEvents", () => {
  it("merges every event's occurrences in chronological order", () => {
    const weekly = makeEvent({
      id: "weekly",
      title: "Institute",
      eventDate: "2026-08-11",
      startTime: "19:00",
      repeatsWeekly: true,
      repeatUntil: "2026-08-25",
    });
    const oneOff = makeEvent({
      id: "one-off",
      title: "Service Project",
      eventDate: "2026-08-15",
      startTime: "09:00",
    });

    const occurrences = expandEvents([oneOff, weekly], {
      from: "2026-08-01",
      to: "2026-08-31",
    });

    expect(occurrences.map((o) => o.key)).toEqual([
      "weekly@2026-08-11",
      "one-off@2026-08-15",
      "weekly@2026-08-18",
      "weekly@2026-08-25",
    ]);
  });

  it("breaks same-instant ties by title", () => {
    const shared = { eventDate: "2026-08-10", startTime: "19:00" };
    const occurrences = expandEvents(
      [
        makeEvent({ id: "b", title: "Volleyball", ...shared }),
        makeEvent({ id: "a", title: "Break the Fast", ...shared }),
      ],
      { from: "2026-08-01", to: "2026-08-31" },
    );

    expect(occurrences.map((o) => o.event.title)).toEqual([
      "Break the Fast",
      "Volleyball",
    ]);
  });

  it("returns nothing when there are no events", () => {
    expect(expandEvents([], { from: "2026-08-01", to: "2026-08-31" })).toEqual([]);
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
    const weekly = makeEvent({
      repeatsWeekly: true,
      eventDate: "2026-08-10",
      repeatUntil: "2026-09-30",
    });

    const next3 = upcomingOccurrences([weekly], {
      now: eveningOfTheNinth,
      limit: 3,
    });

    expect(dates(next3)).toEqual(["2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("bounds an unbounded series at the one-year horizon", () => {
    const forever = makeEvent({ repeatsWeekly: true, repeatUntil: null });

    const occurrences = upcomingOccurrences([forever], {
      now: eveningOfTheNinth,
    });

    expect(occurrences.length).toBeGreaterThan(50);
    expect(occurrences.length).toBeLessThanOrEqual(53);
  });

  it("returns nothing when every event is in the past", () => {
    expect(
      upcomingOccurrences([makeEvent({ eventDate: "2020-01-01" })], {
        now: eveningOfTheNinth,
      }),
    ).toEqual([]);
  });
});
