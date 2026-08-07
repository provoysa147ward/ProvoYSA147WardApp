import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eventSubmissionSchema, isHoneypotTripped } from "@/lib/validation/event";

// 2026-08-07T18:00:00Z is noon in Denver on the 7th, so "today" is 2026-08-07.
const NOW = new Date("2026-08-07T18:00:00Z");
const TODAY = "2026-08-07";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function submission(overrides: Record<string, unknown> = {}) {
  return {
    title: "Volleyball Night",
    category: "sports",
    eventDate: "2026-08-15",
    startTime: "20:00",
    endTime: "22:00",
    location: "Stake center gym",
    description: "All skill levels.",
    repeatsWeekly: false,
    repeatUntil: "",
    submitterName: "Casey",
    submitterContact: "casey@example.com",
    website: "",
    ...overrides,
  };
}

/** The error messages keyed by field, for a submission expected to fail. */
function errorsFor(input: Record<string, unknown>): Record<string, string[]> {
  const result = eventSubmissionSchema.safeParse(input);
  expect(result.success).toBe(false);
  if (result.success) return {};

  const grouped: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    (grouped[key] ??= []).push(issue.message);
  }
  return grouped;
}

describe("a valid submission", () => {
  it("parses and normalises empty optional fields to null", () => {
    const result = eventSubmissionSchema.safeParse(
      submission({ description: "", endTime: "" }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.description).toBeNull();
    expect(result.data.endTime).toBeNull();
    expect(result.data.repeatUntil).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    const result = eventSubmissionSchema.safeParse(
      submission({ title: "  Volleyball Night  ", location: "  Gym  " }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Volleyball Night");
    expect(result.data.location).toBe("Gym");
  });

  it("accepts an event today", () => {
    expect(
      eventSubmissionSchema.safeParse(submission({ eventDate: TODAY })).success,
    ).toBe(true);
  });

  it("accepts an end time earlier than the start as running past midnight", () => {
    const result = eventSubmissionSchema.safeParse(
      submission({ startTime: "21:30", endTime: "00:30" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("required fields", () => {
  it.each([
    ["title", ""],
    ["location", ""],
    ["submitterName", ""],
    ["submitterContact", ""],
  ])("rejects an empty %s", (field, value) => {
    expect(errorsFor(submission({ [field]: value }))).toHaveProperty(field);
  });

  it("rejects an unknown category", () => {
    expect(errorsFor(submission({ category: "dance" }))).toHaveProperty(
      "category",
    );
  });

  it("rejects a malformed date and time", () => {
    expect(errorsFor(submission({ eventDate: "08/15/2026" }))).toHaveProperty(
      "eventDate",
    );
    expect(errorsFor(submission({ startTime: "8pm" }))).toHaveProperty(
      "startTime",
    );
  });

  it("rejects over-long text", () => {
    expect(errorsFor(submission({ title: "x".repeat(121) }))).toHaveProperty(
      "title",
    );
    expect(
      errorsFor(submission({ description: "x".repeat(2001) })),
    ).toHaveProperty("description");
  });
});

describe("date rules", () => {
  it("rejects a date in the past", () => {
    const errors = errorsFor(submission({ eventDate: "2026-08-06" }));
    expect(errors.eventDate).toContain("Pick a date that hasn't passed yet.");
  });

  it("judges 'past' in Denver, not UTC", () => {
    // 03:00Z on the 8th is still 9 PM on the 7th in Denver, so the 7th is today.
    vi.setSystemTime(new Date("2026-08-08T03:00:00Z"));
    expect(
      eventSubmissionSchema.safeParse(submission({ eventDate: "2026-08-07" }))
        .success,
    ).toBe(true);
  });

  it("rejects an end time equal to the start time", () => {
    const errors = errorsFor(
      submission({ startTime: "20:00", endTime: "20:00" }),
    );
    expect(errors.endTime?.[0]).toMatch(/different from the start time/);
  });
});

describe("weekly repeat rules", () => {
  it("requires a repeat-until date when repeating", () => {
    const errors = errorsFor(
      submission({ repeatsWeekly: true, repeatUntil: "" }),
    );
    expect(errors.repeatUntil).toContain(
      "Tell us the last date this should repeat.",
    );
  });

  it("accepts a repeat-until exactly one year out", () => {
    expect(
      eventSubmissionSchema.safeParse(
        submission({
          eventDate: "2026-08-15",
          repeatsWeekly: true,
          repeatUntil: "2027-08-16",
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects a repeat-until more than a year out", () => {
    const errors = errorsFor(
      submission({
        eventDate: "2026-08-15",
        repeatsWeekly: true,
        repeatUntil: "2027-08-17",
      }),
    );
    expect(errors.repeatUntil).toContain(
      "Repeating events can run for at most a year.",
    );
  });

  it("rejects a repeat-until before the first date", () => {
    const errors = errorsFor(
      submission({
        eventDate: "2026-08-15",
        repeatsWeekly: true,
        repeatUntil: "2026-08-14",
      }),
    );
    expect(errors.repeatUntil).toContain(
      "The last date can't be before the first one.",
    );
  });

  it("rejects a repeat-until without the repeat switch on", () => {
    const errors = errorsFor(
      submission({ repeatsWeekly: false, repeatUntil: "2026-09-15" }),
    );
    expect(errors.repeatUntil).toContain(
      "Turn on weekly repeat to set a last date.",
    );
  });
});

describe("honeypot", () => {
  it("rejects a submission with the hidden field filled in", () => {
    expect(errorsFor(submission({ website: "http://spam.example" }))).toHaveProperty(
      "website",
    );
  });

  it("accepts a submission with the field absent entirely", () => {
    const { website, ...withoutHoneypot } = submission();
    expect(website).toBe("");
    expect(eventSubmissionSchema.safeParse(withoutHoneypot).success).toBe(true);
  });

  it("isHoneypotTripped detects only a non-empty value", () => {
    expect(isHoneypotTripped({ website: "spam" })).toBe(true);
    expect(isHoneypotTripped({ website: "   " })).toBe(false);
    expect(isHoneypotTripped({ website: "" })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
  });
});
