import { beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_ADMIN_ACTION_STATE } from "@/lib/adminActionState";
import { NotAdminError, NotAuthenticatedError } from "@/lib/supabase/server";

/**
 * The group mutations, at the seam that matters: what each Supabase outcome
 * turns into for the admin reading the form.
 *
 * The database itself is covered by `tests/db/rls.test.ts` and the browser flow
 * by the e2e suite. What neither can reach is the branch where a write succeeds
 * but matches nothing — another admin deleted the row first — which is exactly
 * the case that used to be reported as success.
 */

const requireAdmin = vi.fn();
const storageUpload = vi.fn();
const getPublicUrl = vi.fn();
const from = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async (importOriginal) => {
  // The error classes are real: `guardMessage` narrows on `instanceof`, so
  // stand-ins would silently fall through to the generic message.
  const actual = await importOriginal<typeof import("@/lib/supabase/server")>();
  return {
    ...actual,
    requireAdmin: () => requireAdmin(),
    createClient: async () => ({
      from,
      storage: {
        from: () => ({ upload: storageUpload, getPublicUrl }),
      },
    }),
  };
});

const { deleteGroup, saveGroup } = await import("./actions");

/**
 * Stand in for one PostgREST call chain. Every builder method returns `this`
 * until the chain is awaited, which is when `result` is handed back.
 */
function tableReturning(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["insert", "update", "delete", "eq", "select"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

const VALID = {
  name: "Volleyball",
  description: "Pickup games every week.",
  emoji: "🏐",
  photoUrl: "",
  meetingInfo: "Tuesdays 8:00 PM",
  groupmeUrl: "https://groupme.com/join_group/123",
  sortOrder: "1",
};

function formData(fields: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...fields })) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ id: "user-1", email: "admin@example.com" });
  from.mockReturnValue(tableReturning({ data: [{ id: "group-1" }], error: null }));
});

describe("saveGroup", () => {
  it("inserts when there is no id, and says so", async () => {
    const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, formData());

    expect(result).toEqual({
      status: "success",
      errors: {},
      message: "Group added.",
    });
  });

  it("updates when an id rides along, and says so", async () => {
    const result = await saveGroup(
      INITIAL_ADMIN_ACTION_STATE,
      formData({ id: "group-1" }),
    );

    expect(result).toEqual({
      status: "success",
      errors: {},
      message: "Group saved.",
    });
  });

  it("reports the row is gone when an update matches nothing", async () => {
    // The case this branch exists for: another admin deleted the group between
    // this one opening the form and submitting it. Reporting success here would
    // tell them their edit landed when it went nowhere.
    from.mockReturnValue(tableReturning({ data: [], error: null }));

    const result = await saveGroup(
      INITIAL_ADMIN_ACTION_STATE,
      formData({ id: "group-1" }),
    );

    expect(result.status).toBe("error");
    expect(result.formError).toBe(
      "That group no longer exists — reload the page.",
    );
  });

  it("does not mistake an insert's own empty result for a vanished row", async () => {
    from.mockReturnValue(tableReturning({ data: [], error: null }));

    const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, formData());

    expect(result.status).toBe("success");
  });

  it("returns field errors without touching the database", async () => {
    const result = await saveGroup(
      INITIAL_ADMIN_ACTION_STATE,
      formData({ name: "" }),
    );

    expect(result.status).toBe("error");
    expect(result.errors.name).toBeTruthy();
    expect(from).not.toHaveBeenCalled();
  });

  it("refuses a non-https GroupMe link", async () => {
    const result = await saveGroup(
      INITIAL_ADMIN_ACTION_STATE,
      formData({ groupmeUrl: "http://groupme.com/join_group/123" }),
    );

    expect(result.status).toBe("error");
    expect(result.errors.groupmeUrl).toBeTruthy();
  });

  it("surfaces a Supabase failure", async () => {
    from.mockReturnValue(
      tableReturning({ data: null, error: { message: "connection reset" } }),
    );

    const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, formData());

    expect(result.status).toBe("error");
    expect(result.formError).toContain("connection reset");
  });

  it("stops at the guard when the caller is not an admin", async () => {
    requireAdmin.mockRejectedValue(new NotAdminError());

    const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, formData());

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/admin access was removed/);
    expect(from).not.toHaveBeenCalled();
  });

  it("stops at the guard when there is no session at all", async () => {
    requireAdmin.mockRejectedValue(new NotAuthenticatedError());

    const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, formData());

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/signed out/);
    expect(from).not.toHaveBeenCalled();
  });

  describe("with a photo chosen", () => {
    const withPhoto = () => {
      const data = formData();
      data.set("photo", new File(["binary"], "team.png", { type: "image/png" }));
      return data;
    };

    it("uploads it and stores the public URL", async () => {
      storageUpload.mockResolvedValue({ error: null });
      getPublicUrl.mockReturnValue({
        data: { publicUrl: "https://cdn.example.com/team.png" },
      });

      const insert = vi.fn(() =>
        tableReturning({ data: [{ id: "group-1" }], error: null }),
      );
      from.mockReturnValue({ insert });

      const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, withPhoto());

      expect(result.status).toBe("success");
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ photo_url: "https://cdn.example.com/team.png" }),
      );
    });

    it("reports a rejected upload without writing anything", async () => {
      storageUpload.mockResolvedValue({ error: { message: "too big" } });

      const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, withPhoto());

      expect(result.status).toBe("error");
      expect(result.formError).toMatch(/wouldn't upload/);
      expect(from).not.toHaveBeenCalled();
    });

    it("validates before uploading, so a rejected form orphans nothing", async () => {
      const data = withPhoto();
      data.set("name", "");

      const result = await saveGroup(INITIAL_ADMIN_ACTION_STATE, data);

      expect(result.status).toBe("error");
      expect(storageUpload).not.toHaveBeenCalled();
    });
  });
});

describe("deleteGroup", () => {
  const idOnly = (id = "group-1") => {
    const data = new FormData();
    data.set("id", id);
    return data;
  };

  it("deletes the group and says so", async () => {
    const result = await deleteGroup(INITIAL_ADMIN_ACTION_STATE, idOnly());

    expect(result).toEqual({
      status: "success",
      errors: {},
      message: "Group deleted.",
    });
  });

  it("reports the row is gone when the delete matches nothing", async () => {
    from.mockReturnValue(tableReturning({ data: [], error: null }));

    const result = await deleteGroup(INITIAL_ADMIN_ACTION_STATE, idOnly());

    expect(result.status).toBe("error");
    expect(result.formError).toBe(
      "That group no longer exists — reload the page.",
    );
  });

  it("surfaces a Supabase failure", async () => {
    from.mockReturnValue(
      tableReturning({ data: null, error: { message: "connection reset" } }),
    );

    const result = await deleteGroup(INITIAL_ADMIN_ACTION_STATE, idOnly());

    expect(result.status).toBe("error");
    expect(result.formError).toContain("connection reset");
  });

  it("stops at the guard when the caller is not an admin", async () => {
    requireAdmin.mockRejectedValue(new NotAdminError());

    const result = await deleteGroup(INITIAL_ADMIN_ACTION_STATE, idOnly());

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/admin access was removed/);
    expect(from).not.toHaveBeenCalled();
  });
});
