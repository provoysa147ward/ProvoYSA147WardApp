import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addAdmin,
  anonClient,
  assertSeededPermanentAdmin,
  createUser,
  deleteUser,
  removeAdmin,
  SEEDED_PERMANENT_EMAIL,
  serviceClient,
  type TestUser,
} from "./helpers";

/**
 * The turnover drill.
 *
 * This is the scenario the whole handoff design exists for: an admin moves out
 * of the ward, adds their replacement, and removes themselves — entirely
 * through the site, with no developer involved and no way to end up with zero
 * admins.
 */

const WARD_EMAIL = SEEDED_PERMANENT_EMAIL;
const ADMIN_A = "turnover-a@example.com";
const ADMIN_B = "turnover-b@example.com";

let adminA: TestUser;
let adminB: TestUser;

beforeAll(async () => {
  await assertSeededPermanentAdmin();
  adminA = await createUser(ADMIN_A);
  adminB = await createUser(ADMIN_B);
  await addAdmin(ADMIN_A);
}, 60_000);

afterAll(async () => {
  await removeAdmin(ADMIN_A);
  await removeAdmin(ADMIN_B);
  await deleteUser(adminA.id);
  await deleteUser(adminB.id);
});

describe("an admin hands over to their replacement", () => {
  it("runs end to end without anyone losing access", async () => {
    // Before: B is not an admin and can see nothing.
    const bBefore = await adminB.client.from("admin_emails").select("email");
    expect(bBefore.data ?? []).toEqual([]);

    // 1. A adds B.
    const added = await adminA.client
      .from("admin_emails")
      .insert({ email: ADMIN_B });
    expect(added.error).toBeNull();

    // 2. B is now an admin — proven by B being able to do admin work, not just
    //    by the row existing.
    const bAfter = await adminB.client.from("admin_emails").select("email");
    expect((bAfter.data ?? []).length).toBeGreaterThan(0);

    const bWrite = await adminB.client
      .from("site_settings")
      .update({ announcement: "B is in charge now." })
      .eq("id", 1)
      .select("id");
    expect(bWrite.error).toBeNull();
    expect(bWrite.data).toHaveLength(1);

    // 3. A removes themselves.
    const removedSelf = await adminA.client
      .from("admin_emails")
      .delete()
      .eq("email", ADMIN_A);
    expect(removedSelf.error).toBeNull();

    // 4. A has genuinely lost access.
    const aAfter = await adminA.client.from("admin_emails").select("email");
    expect(aAfter.data ?? []).toEqual([]);

    const aWrite = await adminA.client
      .from("site_settings")
      .update({ announcement: "A sneaking back in." })
      .eq("id", 1)
      .select("id");
    expect(aWrite.data ?? []).toEqual([]);

    // 5. B still has it, and the ward row is still there as the backstop.
    const stillThere = await adminB.client
      .from("admin_emails")
      .select("email, is_permanent")
      .eq("email", WARD_EMAIL);
    expect(stillThere.data).toHaveLength(1);
    expect(stillThere.data?.[0].is_permanent).toBe(true);
  });
});

describe("the ward can never be locked out", () => {
  it("refuses to delete the permanent row through the API", async () => {
    const { error } = await adminB.client
      .from("admin_emails")
      .delete()
      .eq("email", WARD_EMAIL);

    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("admin_emails")
      .select("email")
      .eq("email", WARD_EMAIL);
    expect(data).toHaveLength(1);
  });

  it("rolls back a multi-row delete that would sweep the permanent row up", async () => {
    // One DELETE is one transaction, so the trigger firing on the ward's row
    // aborts the whole statement — the other admins survive too, rather than
    // being deleted right up to the point the trigger fired.
    const { error } = await adminB.client
      .from("admin_emails")
      .delete()
      .in("email", [ADMIN_B, WARD_EMAIL]);

    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("admin_emails")
      .select("email")
      .in("email", [ADMIN_B, WARD_EMAIL]);
    expect(data?.map((row) => row.email).sort()).toEqual(
      [ADMIN_B, WARD_EMAIL].sort(),
    );
  });

  it("keeps the allowlist invisible to the public throughout", async () => {
    const { data } = await anonClient().from("admin_emails").select("email");
    expect(data ?? []).toEqual([]);
  });
});
