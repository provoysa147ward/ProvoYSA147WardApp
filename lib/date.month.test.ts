import { describe, expect, it } from "vitest";

import {
  daysInMonth,
  firstDayOfMonth,
  formatMonthLabel,
  formatMonthParam,
  isInMonth,
  monthGridRange,
  monthGridWeeks,
  monthOf,
  parseMonthParam,
  shiftMonth,
  weekdayOf,
} from "@/lib/date";

const AUGUST_2026 = { year: 2026, month: 8 };

describe("month keys", () => {
  it("reads a month from a date and renders it back", () => {
    expect(monthOf("2026-08-07")).toEqual(AUGUST_2026);
    expect(formatMonthParam(AUGUST_2026)).toBe("2026-08");
    expect(formatMonthParam({ year: 2026, month: 1 })).toBe("2026-01");
  });

  it("labels the month for display", () => {
    expect(formatMonthLabel(AUGUST_2026)).toBe("August 2026");
  });
});

describe("parseMonthParam", () => {
  it("accepts a well-formed parameter", () => {
    expect(parseMonthParam("2027-03", AUGUST_2026)).toEqual({
      year: 2027,
      month: 3,
    });
  });

  it.each([undefined, "", "2027-3", "2027/03", "2027-13", "2027-00", "junk"])(
    "falls back for %o",
    (input) => {
      expect(parseMonthParam(input, AUGUST_2026)).toEqual(AUGUST_2026);
    },
  );
});

describe("shiftMonth", () => {
  it("moves within a year", () => {
    expect(shiftMonth(AUGUST_2026, 1)).toEqual({ year: 2026, month: 9 });
    expect(shiftMonth(AUGUST_2026, -1)).toEqual({ year: 2026, month: 7 });
  });

  it("rolls across December and January", () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({
      year: 2027,
      month: 1,
    });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("handles multi-year jumps in both directions", () => {
    expect(shiftMonth(AUGUST_2026, 12)).toEqual({ year: 2027, month: 8 });
    expect(shiftMonth(AUGUST_2026, -20)).toEqual({ year: 2024, month: 12 });
  });
});

describe("daysInMonth", () => {
  it.each([
    [{ year: 2026, month: 1 }, 31],
    [{ year: 2026, month: 2 }, 28],
    [{ year: 2028, month: 2 }, 29],
    [{ year: 2026, month: 4 }, 30],
    [{ year: 2026, month: 12 }, 31],
  ])("counts %o as %i days", (key, expected) => {
    expect(daysInMonth(key)).toBe(expected);
  });
});

describe("weekdayOf", () => {
  it("returns 0 for Sunday through 6 for Saturday", () => {
    expect(weekdayOf("2026-08-09")).toBe(0);
    expect(weekdayOf("2026-08-15")).toBe(6);
  });
});

describe("monthGridWeeks", () => {
  it("starts each week on a Sunday", () => {
    for (const week of monthGridWeeks(AUGUST_2026)) {
      expect(weekdayOf(week[0])).toBe(0);
      expect(week).toHaveLength(7);
    }
  });

  it("pads the first row with the previous month", () => {
    // 1 August 2026 is a Saturday, so the first row is 26-31 July then 1 August.
    const [firstWeek] = monthGridWeeks(AUGUST_2026);
    expect(firstWeek[0]).toBe("2026-07-26");
    expect(firstWeek[6]).toBe("2026-08-01");
  });

  it("includes every day of the month exactly once", () => {
    const days = monthGridWeeks(AUGUST_2026)
      .flat()
      .filter((date) => isInMonth(date, AUGUST_2026));

    expect(days).toHaveLength(31);
    expect(new Set(days).size).toBe(31);
    expect(days[0]).toBe(firstDayOfMonth(AUGUST_2026));
  });

  it("uses only as many rows as the month needs", () => {
    // February 2027 starts on a Monday and has 28 days: five rows.
    expect(monthGridWeeks({ year: 2027, month: 2 })).toHaveLength(5);
    // August 2026 starts on a Saturday and has 31 days: six rows.
    expect(monthGridWeeks(AUGUST_2026)).toHaveLength(6);
  });

  it("needs only four rows for a February starting on a Sunday", () => {
    // February 2026 starts on a Sunday and has 28 days: exactly four rows.
    expect(monthGridWeeks({ year: 2026, month: 2 })).toHaveLength(4);
  });
});

describe("monthGridRange", () => {
  it("spans the padded grid, not just the month", () => {
    expect(monthGridRange(AUGUST_2026)).toEqual({
      from: "2026-07-26",
      to: "2026-09-05",
    });
  });
});

describe("isInMonth", () => {
  it("distinguishes the month's own days from the padding", () => {
    expect(isInMonth("2026-08-01", AUGUST_2026)).toBe(true);
    expect(isInMonth("2026-07-31", AUGUST_2026)).toBe(false);
    expect(isInMonth("2025-08-01", AUGUST_2026)).toBe(false);
  });
});
