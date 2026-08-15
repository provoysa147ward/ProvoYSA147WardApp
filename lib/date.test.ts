import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  differenceInCalendarDays,
  endsNextDay,
  formatDayLabel,
  formatTimeLabel,
  formatTimeRange,
  formatWeekLabel,
  parseIsoDate,
  parseIsoTime,
  toIsoDate,
  toUtcIso,
  wardInstant,
  wardToday,
  weekRange,
} from "@/lib/date";

// 2026 US DST boundaries: spring forward Sun 8 Mar, fall back Sun 1 Nov.
const SPRING_FORWARD = "2026-03-08";
const FALL_BACK = "2026-11-01";

describe("parseIsoDate", () => {
  it("splits a well-formed date into 1-indexed parts", () => {
    expect(parseIsoDate("2026-08-07")).toEqual({
      year: 2026,
      month: 8,
      day: 7,
    });
  });

  it.each(["2026-8-07", "08/07/2026", "2026-08-07T12:00", ""])(
    "rejects %o",
    (input) => {
      expect(() => parseIsoDate(input)).toThrow(TypeError);
    },
  );
});

describe("parseIsoTime", () => {
  it("defaults seconds to zero when absent", () => {
    expect(parseIsoTime("19:30")).toEqual({
      hours: 19,
      minutes: 30,
      seconds: 0,
    });
  });

  it("reads the seconds Postgres sends back", () => {
    expect(parseIsoTime("19:30:45")).toEqual({
      hours: 19,
      minutes: 30,
      seconds: 45,
    });
  });

  it.each(["7:30", "1930", "19:30:45.5", ""])("rejects %o", (input) => {
    expect(() => parseIsoTime(input)).toThrow(TypeError);
  });
});

describe("toIsoDate", () => {
  it("zero-pads month and day", () => {
    expect(toIsoDate({ year: 2026, month: 3, day: 8 })).toBe("2026-03-08");
  });
});

describe("wardInstant", () => {
  it("keeps the same wall-clock hour on both sides of fall-back", () => {
    const before = wardInstant("2026-10-25", "19:00");
    const after = wardInstant(FALL_BACK, "19:00");

    expect(before.getHours()).toBe(19);
    expect(after.getHours()).toBe(19);
    // Mountain Daylight (UTC-6) then Mountain Standard (UTC-7).
    expect(toUtcIso(before)).toBe("2026-10-26T01:00:00.000Z");
    expect(toUtcIso(after)).toBe("2026-11-02T02:00:00.000Z");
  });

  it("keeps the same wall-clock hour on both sides of spring-forward", () => {
    const before = wardInstant("2026-03-01", "19:00");
    const after = wardInstant(SPRING_FORWARD, "19:00");

    expect(before.getHours()).toBe(19);
    expect(after.getHours()).toBe(19);
    expect(toUtcIso(before)).toBe("2026-03-02T02:00:00.000Z");
    expect(toUtcIso(after)).toBe("2026-03-09T01:00:00.000Z");
  });

  it("spans 169 real hours across a fall-back week and 167 across spring-forward", () => {
    const hoursBetween = (from: string, to: string) =>
      (wardInstant(to, "19:00").getTime() - wardInstant(from, "19:00").getTime()) /
      3_600_000;

    expect(hoursBetween("2026-10-25", FALL_BACK)).toBe(169);
    expect(hoursBetween("2026-03-01", SPRING_FORWARD)).toBe(167);
  });

  it("resolves seconds from a Postgres time value", () => {
    expect(toUtcIso(wardInstant("2026-08-07", "19:30:45"))).toBe(
      "2026-08-08T01:30:45.000Z",
    );
  });
});

describe("toUtcIso", () => {
  it("normalises a ward instant to a Z-suffixed UTC string", () => {
    // TZDate's own toISOString() would report the -06:00 offset form here.
    expect(toUtcIso(wardInstant("2026-08-07", "19:00"))).toBe(
      "2026-08-08T01:00:00.000Z",
    );
  });

  it("leaves a plain Date unchanged", () => {
    const plain = new Date("2026-08-07T19:00:00Z");
    expect(toUtcIso(plain)).toBe(plain.toISOString());
  });
});

describe("addCalendarDays", () => {
  it("adds a week across fall-back without losing a day", () => {
    expect(addCalendarDays("2026-10-25", 7)).toBe(FALL_BACK);
  });

  it("adds a week across spring-forward without losing a day", () => {
    expect(addCalendarDays("2026-03-01", 7)).toBe(SPRING_FORWARD);
  });

  it("rolls over month, year, and leap-day boundaries", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("subtracts with a negative count", () => {
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("differenceInCalendarDays", () => {
  it("counts whole days across a DST boundary", () => {
    expect(differenceInCalendarDays(FALL_BACK, "2026-10-25")).toBe(7);
    expect(differenceInCalendarDays(SPRING_FORWARD, "2026-03-01")).toBe(7);
  });

  it("is zero for the same date and negative when reversed", () => {
    expect(differenceInCalendarDays("2026-08-07", "2026-08-07")).toBe(0);
    expect(differenceInCalendarDays("2026-08-07", "2026-08-14")).toBe(-7);
  });
});

describe("wardToday", () => {
  it("reports the Denver date, not the UTC date, late in the evening", () => {
    // 01:30 UTC on the 8th is 19:30 on the 7th in Denver.
    expect(wardToday(new Date("2026-08-08T01:30:00Z"))).toBe("2026-08-07");
  });

  it("rolls over exactly at Denver midnight, not UTC midnight", () => {
    expect(wardToday(new Date("2026-08-08T05:59:59Z"))).toBe("2026-08-07");
    expect(wardToday(new Date("2026-08-08T06:00:00Z"))).toBe("2026-08-08");
  });

  it("uses the standard-time offset in winter", () => {
    // Denver is UTC-7 in January, so midnight arrives an hour later in UTC.
    expect(wardToday(new Date("2026-01-08T06:59:59Z"))).toBe("2026-01-07");
    expect(wardToday(new Date("2026-01-08T07:00:00Z"))).toBe("2026-01-08");
  });
});

describe("endsNextDay", () => {
  it("is true only when the end time is strictly earlier than the start", () => {
    expect(endsNextDay("21:00", "00:30")).toBe(true);
    expect(endsNextDay("21:00", "23:00")).toBe(false);
    expect(endsNextDay("21:00", "21:00")).toBe(false);
    expect(endsNextDay("21:00", null)).toBe(false);
  });
});

describe("formatTimeLabel", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["09:05", "9:05 AM"],
    ["12:00", "12:00 PM"],
    ["12:45", "12:45 PM"],
    ["19:00", "7:00 PM"],
    ["23:59:00", "11:59 PM"],
  ])("renders %s as %s", (input, expected) => {
    expect(formatTimeLabel(input)).toBe(expected);
  });
});

describe("formatDayLabel", () => {
  it("names the weekday and month", () => {
    expect(formatDayLabel("2026-08-08")).toBe("Saturday, August 8");
  });

  it("accepts a caller-supplied pattern", () => {
    expect(formatDayLabel("2026-08-08", "MMMM yyyy")).toBe("August 2026");
  });

  it("labels a spring-forward day correctly", () => {
    expect(formatDayLabel(SPRING_FORWARD)).toBe("Sunday, March 8");
  });
});

describe("formatTimeRange", () => {
  it("shows only the start when there is no end time", () => {
    expect(formatTimeRange("19:00", null)).toBe("7:00 PM");
  });

  it("shows a plain range within one day", () => {
    expect(formatTimeRange("19:00", "21:00")).toBe("7:00 PM – 9:00 PM");
  });

  it("flags a range that runs past midnight", () => {
    expect(formatTimeRange("21:00", "00:30")).toBe(
      "9:00 PM – 12:30 AM (next day)",
    );
  });
});

describe("weekRange", () => {
  it("returns the Sunday-to-Saturday week containing a midweek date", () => {
    expect(weekRange("2026-08-19")).toEqual({
      from: "2026-08-16",
      to: "2026-08-22",
    });
  });

  it("treats a Sunday as the start of its own week", () => {
    expect(weekRange("2026-08-16")).toEqual({
      from: "2026-08-16",
      to: "2026-08-22",
    });
  });

  it("treats a Saturday as the end of its own week", () => {
    expect(weekRange("2026-08-22")).toEqual({
      from: "2026-08-16",
      to: "2026-08-22",
    });
  });

  it("crosses a month boundary", () => {
    expect(weekRange("2026-09-01")).toEqual({
      from: "2026-08-30",
      to: "2026-09-05",
    });
  });

  it("crosses a year boundary", () => {
    expect(weekRange("2027-01-01")).toEqual({
      from: "2026-12-27",
      to: "2027-01-02",
    });
  });

  it("is unaffected by a DST boundary inside the week", () => {
    expect(weekRange(SPRING_FORWARD)).toEqual({
      from: "2026-03-08",
      to: "2026-03-14",
    });
    expect(weekRange(FALL_BACK)).toEqual({
      from: "2026-11-01",
      to: "2026-11-07",
    });
  });
});

describe("formatWeekLabel", () => {
  it("collapses a week inside one month", () => {
    expect(formatWeekLabel(weekRange("2026-08-19"))).toBe("Aug 16 – 22, 2026");
  });

  it("names both months when the week straddles one", () => {
    expect(formatWeekLabel(weekRange("2026-09-01"))).toBe(
      "Aug 30 – Sep 5, 2026",
    );
  });

  it("names both years when the week straddles one", () => {
    expect(formatWeekLabel(weekRange("2027-01-01"))).toBe(
      "Dec 27, 2026 – Jan 2, 2027",
    );
  });
});
