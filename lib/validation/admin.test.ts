import { describe, expect, it } from "vitest";

import {
  adminEmailSchema,
  groupSchema,
  quickLinkSchema,
} from "@/lib/validation/admin";

describe("groupSchema", () => {
  const group = (overrides: Record<string, unknown> = {}) => ({
    name: "Volleyball",
    description: "Pickup games every week.",
    emoji: "🏐",
    photoUrl: "",
    meetingInfo: "Tuesdays 8 PM",
    groupmeUrl: "https://groupme.com/join_group/123",
    sortOrder: "1",
    ...overrides,
  });

  it("parses a full group and coerces sortOrder", () => {
    const result = groupSchema.safeParse(group());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sortOrder).toBe(1);
    expect(result.data.photoUrl).toBeNull();
  });

  it("requires a name and a description", () => {
    expect(groupSchema.safeParse(group({ name: "" })).success).toBe(false);
    expect(groupSchema.safeParse(group({ description: "" })).success).toBe(false);
  });

  it("accepts a group with no GroupMe link", () => {
    const result = groupSchema.safeParse(group({ groupmeUrl: "" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.groupmeUrl).toBeNull();
  });

  it.each([
    "http://groupme.com/join_group/123",
    "javascript:alert(1)",
    "//groupme.com/join_group/123",
    "ftp://example.com",
  ])("rejects the non-https link %s", (url) => {
    expect(groupSchema.safeParse(group({ groupmeUrl: url })).success).toBe(false);
  });
});

describe("quickLinkSchema", () => {
  const link = (overrides: Record<string, unknown> = {}) => ({
    label: "Ward Calendar",
    url: "https://calendar.google.com",
    sortOrder: 0,
    ...overrides,
  });

  it("parses a valid link", () => {
    expect(quickLinkSchema.safeParse(link()).success).toBe(true);
  });

  it("requires a label", () => {
    expect(quickLinkSchema.safeParse(link({ label: "" })).success).toBe(false);
  });

  it.each(["http://example.com", "javascript:alert(1)", "not a url", ""])(
    "rejects the url %o",
    (url) => {
      expect(quickLinkSchema.safeParse(link({ url })).success).toBe(false);
    },
  );
});

describe("adminEmailSchema", () => {
  it("lowercases and trims before validating", () => {
    const result = adminEmailSchema.safeParse({
      email: "  New.Admin@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("new.admin@example.com");
  });

  it.each(["", "not-an-email", "missing@tld", "@example.com"])(
    "rejects %o",
    (email) => {
      expect(adminEmailSchema.safeParse({ email }).success).toBe(false);
    },
  );
});
