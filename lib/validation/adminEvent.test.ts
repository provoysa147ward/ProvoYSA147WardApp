import { describe, expect, it } from "vitest";

import { adminEventSchema, toEventRow } from "@/lib/validation/adminEvent";

function adminEvent(overrides: Record<string, unknown> = {}) {
  return {
    title: "Institute Class",
    category: "spiritual",
    eventDate: "2026-09-14",
    startTime: "19:00",
    endTime: "20:30",
    location: "Institute building",
    description: "",
    repeatsWeekly: false,
    repeatUntil: "",
    submitterName: "Ward admin",
    submitterContact: "admin@example.com",
    ...overrides,
  };
}

describe("adminEventSchema", () => {
  it("parses a valid event", () => {
    expect(adminEventSchema.safeParse(adminEvent()).success).toBe(true);
  });

  it("allows a date in the past, unlike the public form", () => {
    // Correcting last week's entry is ordinary admin work.
    expect(
      adminEventSchema.safeParse(adminEvent({ eventDate: "2020-01-01" }))
        .success,
    ).toBe(true);
  });

  it("still requires the basics", () => {
    expect(adminEventSchema.safeParse(adminEvent({ title: "" })).success).toBe(
      false,
    );
    expect(
      adminEventSchema.safeParse(adminEvent({ location: "" })).success,
    ).toBe(false);
    expect(
      adminEventSchema.safeParse(adminEvent({ category: "dance" })).success,
    ).toBe(false);
  });

  it("accepts an end time before the start as past midnight", () => {
    expect(
      adminEventSchema.safeParse(
        adminEvent({ startTime: "22:00", endTime: "01:00" }),
      ).success,
    ).toBe(true);
  });

  it("rejects an end time equal to the start", () => {
    const result = adminEventSchema.safeParse(
      adminEvent({ startTime: "19:00", endTime: "19:00" }),
    );
    expect(result.success).toBe(false);
  });

  it("requires a last date on a repeating event", () => {
    expect(
      adminEventSchema.safeParse(
        adminEvent({ repeatsWeekly: true, repeatUntil: "" }),
      ).success,
    ).toBe(false);
  });

  it("caps a series at one year", () => {
    expect(
      adminEventSchema.safeParse(
        adminEvent({
          eventDate: "2026-09-14",
          repeatsWeekly: true,
          repeatUntil: "2027-09-15",
        }),
      ).success,
    ).toBe(true);
    expect(
      adminEventSchema.safeParse(
        adminEvent({
          eventDate: "2026-09-14",
          repeatsWeekly: true,
          repeatUntil: "2027-09-16",
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects a last date without the repeat switch", () => {
    expect(
      adminEventSchema.safeParse(
        adminEvent({ repeatsWeekly: false, repeatUntil: "2026-10-01" }),
      ).success,
    ).toBe(false);
  });
});

describe("toEventRow", () => {
  it("maps onto the database column names and nulls blanks", () => {
    const parsed = adminEventSchema.parse(
      adminEvent({ description: "", endTime: "" }),
    );

    expect(toEventRow(parsed)).toEqual({
      title: "Institute Class",
      category: "spiritual",
      event_date: "2026-09-14",
      start_time: "19:00",
      end_time: null,
      location: "Institute building",
      description: null,
      repeats_weekly: false,
      repeat_until: null,
      submitter_name: "Ward admin",
      submitter_contact: "admin@example.com",
    });
  });

  it("never emits a status — callers set that explicitly", () => {
    const parsed = adminEventSchema.parse(adminEvent());
    expect(toEventRow(parsed)).not.toHaveProperty("status");
  });
});
