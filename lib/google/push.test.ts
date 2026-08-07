import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The network branches of the Google push.
 *
 * These are the paths that make sync safe to retry — 409 means the event is
 * already there, 404/410 mean it is not — and none of them run in the other
 * suites, because without credentials every call short-circuits before it gets
 * this far. A fake calendar client is the only way to reach them.
 */

const events = vi.hoisted(() => ({
  insert: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: { JWT: class {} },
    calendar: () => ({ events }),
  },
}));
vi.mock("server-only", () => ({}));

const { pushEvent, patchEvent, deleteEvent, googleEventId } = await import(
  "@/lib/google/calendar"
);

const event = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  title: "Institute Class",
  location: "Institute building",
  description: null,
  eventDate: "2026-08-10",
  startTime: "19:00",
  endTime: "20:30",
  repeatsWeekly: false,
  repeatUntil: null,
};

/** googleapis throws errors carrying a numeric `code`. */
function httpError(code: number) {
  return Object.assign(new Error(`HTTP ${code}`), { code });
}

const originalEnv = { ...process.env };

function enableSync() {
  process.env.GOOGLE_SA_CLIENT_EMAIL = "sa@example.iam.gserviceaccount.com";
  process.env.GOOGLE_SA_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\\nx\\n";
  process.env.GOOGLE_CALENDAR_ID = "ward@group.calendar.google.com";
}

beforeEach(() => {
  vi.clearAllMocks();
  enableSync();
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("pushEvent", () => {
  it("reports the derived id on success", async () => {
    events.insert.mockResolvedValue({});

    await expect(pushEvent(event)).resolves.toEqual({
      ok: true,
      googleEventId: googleEventId(event.id),
    });
    expect(events.insert).toHaveBeenCalledOnce();
  });

  it("treats a 409 conflict as success — the event is already there", async () => {
    events.insert.mockRejectedValue(httpError(409));

    await expect(pushEvent(event)).resolves.toEqual({
      ok: true,
      googleEventId: googleEventId(event.id),
    });
  });

  it("reports any other failure without throwing", async () => {
    events.insert.mockRejectedValue(httpError(500));

    const result = await pushEvent(event);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("500");
  });

  it("skips entirely when credentials are absent", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;

    await expect(pushEvent(event)).resolves.toEqual({
      ok: true,
      skipped: "disabled",
    });
    expect(events.insert).not.toHaveBeenCalled();
  });
});

describe("patchEvent", () => {
  it("patches an existing event", async () => {
    events.patch.mockResolvedValue({});

    await expect(patchEvent(event)).resolves.toEqual({
      ok: true,
      googleEventId: googleEventId(event.id),
    });
    expect(events.insert).not.toHaveBeenCalled();
  });

  it.each([404, 410])(
    "falls back to creating the event on %i",
    async (code) => {
      events.patch.mockRejectedValue(httpError(code));
      events.insert.mockResolvedValue({});

      await expect(patchEvent(event)).resolves.toEqual({
        ok: true,
        googleEventId: googleEventId(event.id),
      });
      expect(events.insert).toHaveBeenCalledOnce();
    },
  );

  it("reports a genuine failure rather than silently creating a duplicate", async () => {
    events.patch.mockRejectedValue(httpError(403));

    const result = await patchEvent(event);
    expect(result.ok).toBe(false);
    expect(events.insert).not.toHaveBeenCalled();
  });
});

describe("deleteEvent", () => {
  it("deletes an existing event", async () => {
    events.delete.mockResolvedValue({});

    await expect(deleteEvent(event.id)).resolves.toEqual({
      ok: true,
      googleEventId: googleEventId(event.id),
    });
  });

  it.each([404, 410])("treats %i as already gone", async (code) => {
    events.delete.mockRejectedValue(httpError(code));

    await expect(deleteEvent(event.id)).resolves.toEqual({
      ok: true,
      googleEventId: googleEventId(event.id),
    });
  });

  it("reports a real failure so the admin is told to tidy up by hand", async () => {
    events.delete.mockRejectedValue(httpError(500));

    const result = await deleteEvent(event.id);
    expect(result.ok).toBe(false);
  });
});

describe("every entry point", () => {
  it("returns rather than throwing, so an approval is never blocked", async () => {
    events.insert.mockRejectedValue(new Error("network down"));
    events.patch.mockRejectedValue(new Error("network down"));
    events.delete.mockRejectedValue(new Error("network down"));

    await expect(pushEvent(event)).resolves.toMatchObject({ ok: false });
    await expect(patchEvent(event)).resolves.toMatchObject({ ok: false });
    await expect(deleteEvent(event.id)).resolves.toMatchObject({ ok: false });
  });
});
