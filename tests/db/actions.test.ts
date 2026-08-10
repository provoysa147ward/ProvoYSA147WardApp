import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  addAdmin,
  anonClient,
  createUser,
  deleteEvent,
  deleteUser,
  eventFixture,
  removeAdmin,
  seedEvent,
  serviceClient,
  type TestUser,
} from "./helpers";

/**
 * Semantics the admin actions depend on, proven against a real database.
 *
 * These are deliberately not mocked. The approve race is a property of how
 * Postgres serialises two concurrent UPDATEs — a mock would only prove that
 * the code I wrote does what I think it does, which is the wrong question.
 */

const ADMIN_EMAIL = "actions-admin@example.com";
const SECOND_ADMIN_EMAIL = "actions-admin-2@example.com";
const MEMBER_EMAIL = "actions-member@example.com";

let admin: TestUser;
let otherAdmin: TestUser;
let member: TestUser;

beforeAll(async () => {
  admin = await createUser(ADMIN_EMAIL);
  otherAdmin = await createUser(SECOND_ADMIN_EMAIL);
  member = await createUser(MEMBER_EMAIL);
  await addAdmin(ADMIN_EMAIL);
  await addAdmin(SECOND_ADMIN_EMAIL);
}, 60_000);

afterAll(async () => {
  await removeAdmin(ADMIN_EMAIL);
  await removeAdmin(SECOND_ADMIN_EMAIL);
  await Promise.all([admin.id, otherAdmin.id, member.id].map(deleteUser));
});

/** The exact statement `approveEvent` issues. */
const approve = (client: TestUser["client"], id: string) =>
  client
    .from("events")
    .update({ status: "approved" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

describe("the approve race", () => {
  it("lets exactly one of two concurrent approvals win", async () => {
    const id = await seedEvent({ status: "pending", title: "Race Target" });

    const [first, second] = await Promise.all([
      approve(admin.client, id),
      approve(otherAdmin.client, id),
    ]);

    const winners = [first, second].filter(
      (result) => (result.data?.length ?? 0) === 1,
    );
    const losers = [first, second].filter(
      (result) => (result.data?.length ?? 0) === 0,
    );

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const { data } = await serviceClient()
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(data?.status).toBe("approved");

    await deleteEvent(id);
  });

  it("survives five simultaneous approvals with one winner", async () => {
    const id = await seedEvent({ status: "pending", title: "Race Target 5" });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => approve(admin.client, id)),
    );

    const winners = results.filter((r) => (r.data?.length ?? 0) === 1);
    expect(winners).toHaveLength(1);

    await deleteEvent(id);
  });

  it("refuses to re-approve an already-approved event", async () => {
    const id = await seedEvent({ status: "approved", title: "Already Live" });

    const { data } = await approve(admin.client, id);
    expect(data).toEqual([]);

    await deleteEvent(id);
  });

  it("refuses to approve a rejected event", async () => {
    const id = await seedEvent({ status: "rejected", title: "Already Out" });

    const { data } = await approve(admin.client, id);
    expect(data).toEqual([]);

    const { data: row } = await serviceClient()
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(row?.status).toBe("rejected");

    await deleteEvent(id);
  });
});

describe("reject keeps the record", () => {
  it("changes status rather than deleting the row", async () => {
    const id = await seedEvent({ status: "pending", title: "To Reject" });

    await admin.client
      .from("events")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("status", "pending");

    const { data } = await serviceClient()
      .from("events")
      .select("status, submitter_contact")
      .eq("id", id)
      .single();

    expect(data?.status).toBe("rejected");
    // The contact survives, so an admin can explain the decision if asked.
    expect(data?.submitter_contact).toBeTruthy();

    await deleteEvent(id);
  });

  it("hides a rejected event from the public view", async () => {
    const id = await seedEvent({ status: "rejected", title: "Invisible" });

    const { data } = await anonClient()
      .from("events_public")
      .select("id")
      .eq("id", id);

    expect(data).toEqual([]);
    await deleteEvent(id);
  });
});

describe("a signed-in non-admin invoking an admin write", () => {
  it("cannot approve, even calling PostgREST directly", async () => {
    const id = await seedEvent({ status: "pending", title: "Member Approve" });

    const { data } = await approve(member.client, id);
    expect(data ?? []).toEqual([]);

    const { data: row } = await serviceClient()
      .from("events")
      .select("status")
      .eq("id", id)
      .single();
    expect(row?.status).toBe("pending");

    await deleteEvent(id);
  });

  it("cannot create an approved event", async () => {
    const title = `Member Create ${Date.now()}`;
    const { error } = await member.client
      .from("events")
      .insert(eventFixture({ status: "approved", title }));

    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("events")
      .select("id")
      .eq("title", title);
    expect(data).toEqual([]);
  });

  it("cannot edit or delete an approved event", async () => {
    const id = await seedEvent({ status: "approved", title: "Untouchable" });

    await member.client
      .from("events")
      .update({ title: "Hijacked" })
      .eq("id", id);
    await member.client.from("events").delete().eq("id", id);

    const { data } = await serviceClient()
      .from("events")
      .select("title")
      .eq("id", id)
      .single();
    expect(data?.title).toBe("Untouchable");

    await deleteEvent(id);
  });
});

describe("the admin lifecycle end to end", () => {
  it("carries a suggestion from anon insert to public visibility", async () => {
    const title = `Lifecycle ${Date.now()}`;

    // 1. Anyone suggests it.
    const insert = await anonClient()
      .from("events")
      .insert(eventFixture({ status: undefined, title }));
    expect(insert.error).toBeNull();

    const { data: created } = await serviceClient()
      .from("events")
      .select("id, status")
      .eq("title", title)
      .single();
    expect(created?.status).toBe("pending");

    // 2. It is invisible while pending.
    const whilePending = await anonClient()
      .from("events_public")
      .select("id")
      .eq("id", created!.id);
    expect(whilePending.data).toEqual([]);

    // 3. An admin edits and approves in one statement.
    const approved = await admin.client
      .from("events")
      .update({ title: `${title} (edited)`, status: "approved" })
      .eq("id", created!.id)
      .eq("status", "pending")
      .select("id");
    expect(approved.data).toHaveLength(1);

    // 4. The edited version is what the public sees.
    const { data: live } = await anonClient()
      .from("events_public")
      .select("title")
      .eq("id", created!.id)
      .single();
    expect(live?.title).toBe(`${title} (edited)`);

    // 5. Deleting removes it from the public view.
    await admin.client.from("events").delete().eq("id", created!.id);
    const afterDelete = await anonClient()
      .from("events_public")
      .select("id")
      .eq("id", created!.id);
    expect(afterDelete.data).toEqual([]);
  });
});
