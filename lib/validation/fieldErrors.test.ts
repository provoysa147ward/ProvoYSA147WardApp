import { describe, expect, it } from "vitest";

import { fieldErrors } from "@/lib/validation/fieldErrors";

describe("fieldErrors", () => {
  it("keys messages by their first path segment", () => {
    expect(
      fieldErrors([
        { path: ["title"], message: "Title is required." },
        { path: ["location"], message: "Location is required." },
      ]),
    ).toEqual({
      title: "Title is required.",
      location: "Location is required.",
    });
  });

  it("keeps the first message when a field has several", () => {
    expect(
      fieldErrors([
        { path: ["title"], message: "Fix this first." },
        { path: ["title"], message: "And this." },
      ]),
    ).toEqual({ title: "Fix this first." });
  });

  it("falls back to a form-level key when there is no path", () => {
    expect(fieldErrors([{ path: [], message: "Something is wrong." }])).toEqual({
      form: "Something is wrong.",
    });
  });

  it("uses only the first segment of a nested path", () => {
    expect(
      fieldErrors([{ path: ["contact", "email"], message: "Bad email." }]),
    ).toEqual({ contact: "Bad email." });
  });

  it("returns an empty object for no issues", () => {
    expect(fieldErrors([])).toEqual({});
  });
});
