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
 * The RLS matrix, proven against a real PostgREST.
 *
 * Every cell is asserted in both directions: what a role *can* do as well as
 * what it cannot. A test suite that only proves denial would still pass if the
 * whole API were broken.
 */

const ADMIN_EMAIL = "rls-admin@example.com";
const MEMBER_EMAIL = "rls-member@example.com";

let admin: TestUser;
let member: TestUser;

beforeAll(async () => {
  admin = await createUser(ADMIN_EMAIL);
  member = await createUser(MEMBER_EMAIL);
  await addAdmin(ADMIN_EMAIL);
  // Re-issue the admin's session so the JWT is minted after the allowlist row
  // exists (is_admin reads the email claim, so this is belt and braces).
  await admin.client.auth.refreshSession();
}, 60_000);

afterAll(async () => {
  await removeAdmin(ADMIN_EMAIL);
  await deleteUser(admin.id);
  await deleteUser(member.id);
});

describe("public content tables", () => {
  const tables = ["groups", "quick_links", "site_settings"] as const;

  it.each(tables)("lets anon read %s", async (table) => {
    const { error } = await anonClient().from(table).select("*").limit(1);
    expect(error).toBeNull();
  });

  it("refuses a non-admin write to groups", async () => {
    const { error } = await member.client
      .from("groups")
      .insert({ name: "Rogue", description: "Nope" });
    expect(error).not.toBeNull();
  });

  it("refuses an anon write to quick_links", async () => {
    const { error } = await anonClient()
      .from("quick_links")
      .insert({ label: "Rogue", url: "https://example.com" });
    expect(error).not.toBeNull();
  });

  it("refuses a non-admin update to site_settings", async () => {
    await member.client
      .from("site_settings")
      .update({ announcement: "Hijacked" })
      .eq("id", 1);

    const { data } = await serviceClient()
      .from("site_settings")
      .select("announcement")
      .eq("id", 1)
      .single();
    expect(data?.announcement).not.toBe("Hijacked");
  });

  it("lets an admin write all three", async () => {
    const group = await admin.client
      .from("groups")
      .insert({ name: "Admin Group", description: "Created in a test." })
      .select("id")
      .single();
    expect(group.error).toBeNull();

    const link = await admin.client
      .from("quick_links")
      .insert({ label: "Admin Link", url: "https://example.com/admin" })
      .select("id")
      .single();
    expect(link.error).toBeNull();

    // site_settings is a single shared row, so restore whatever was there
    // rather than blanking it — the seeded announcement is dev data others use.
    const { data: before } = await serviceClient()
      .from("site_settings")
      .select("announcement")
      .eq("id", 1)
      .single();

    const settings = await admin.client
      .from("site_settings")
      .update({ announcement: "Set by an admin test." })
      .eq("id", 1);
    expect(settings.error).toBeNull();

    await serviceClient().from("groups").delete().eq("id", group.data?.id);
    await serviceClient().from("quick_links").delete().eq("id", link.data?.id);
    await serviceClient()
      .from("site_settings")
      .update({ announcement: before?.announcement ?? "" })
      .eq("id", 1);
  });

  it("enforces the single-row constraint on site_settings", async () => {
    const { error } = await serviceClient()
      .from("site_settings")
      .insert({ id: 2 });
    expect(error).not.toBeNull();
  });

  it("rejects a non-https quick link", async () => {
    const { error } = await admin.client
      .from("quick_links")
      .insert({ label: "Insecure", url: "http://example.com" });
    expect(error).not.toBeNull();
  });
});

describe("admin_emails allowlist", () => {
  it("is invisible to anon", async () => {
    const { data } = await anonClient().from("admin_emails").select("email");
    expect(data ?? []).toEqual([]);
  });

  it("is invisible to a signed-in non-admin", async () => {
    const { data } = await member.client.from("admin_emails").select("email");
    expect(data ?? []).toEqual([]);
  });

  it("cannot be written by a non-admin — no self-promotion", async () => {
    await member.client.from("admin_emails").insert({ email: MEMBER_EMAIL });

    const { data } = await serviceClient()
      .from("admin_emails")
      .select("email")
      .eq("email", MEMBER_EMAIL);
    expect(data).toEqual([]);
  });

  it("is readable and writable by an admin", async () => {
    const newAdmin = `turnover-${Date.now()}@example.com`;

    const insert = await admin.client
      .from("admin_emails")
      .insert({ email: newAdmin });
    expect(insert.error).toBeNull();

    const { data } = await admin.client
      .from("admin_emails")
      .select("email")
      .eq("email", newAdmin);
    expect(data).toHaveLength(1);

    const remove = await admin.client
      .from("admin_emails")
      .delete()
      .eq("email", newAdmin);
    expect(remove.error).toBeNull();
  });

  it("normalises case and whitespace on insert", async () => {
    const messy = `  MiXeD-${Date.now()}@Example.COM  `;
    const normalised = messy.trim().toLowerCase();

    await admin.client.from("admin_emails").insert({ email: messy });

    const { data } = await serviceClient()
      .from("admin_emails")
      .select("email")
      .eq("email", normalised);
    expect(data).toHaveLength(1);

    await serviceClient().from("admin_emails").delete().eq("email", normalised);
  });
});

describe("the permanent ward admin row", () => {
  // The seeded row, not one created here: a permanent row cannot be cleaned up
  // afterwards by design, so creating one per run would leave it behind.
  const WARD_EMAIL = SEEDED_PERMANENT_EMAIL;

  beforeAll(async () => {
    await assertSeededPermanentAdmin();
  });

  it("cannot be deleted by an admin through the API", async () => {
    const { error } = await admin.client
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

  it("cannot be deleted even with the secret key", async () => {
    const { error } = await serviceClient()
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

  it("cannot have its permanence flag removed", async () => {
    const { error } = await admin.client
      .from("admin_emails")
      .update({ is_permanent: false })
      .eq("email", WARD_EMAIL);
    expect(error).not.toBeNull();

    const { data } = await serviceClient()
      .from("admin_emails")
      .select("is_permanent")
      .eq("email", WARD_EMAIL)
      .single();
    expect(data?.is_permanent).toBe(true);
  });
});

describe("group-photos storage bucket", () => {
  const BUCKET = "group-photos";
  const pixel = new Blob(
    [
      Uint8Array.from([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
        0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
        0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
      ]),
    ],
    { type: "image/gif" },
  );

  it("is configured with a 2MB cap and image-only mime types", async () => {
    const { data, error } = await serviceClient().storage.getBucket(BUCKET);

    expect(error).toBeNull();
    expect(data?.public).toBe(true);
    expect(data?.file_size_limit).toBe(2 * 1024 * 1024);
    expect(data?.allowed_mime_types).toContain("image/png");
    expect(data?.allowed_mime_types).not.toContain("application/pdf");
  });

  it("refuses an upload from anon and from a non-admin", async () => {
    const asAnon = await anonClient()
      .storage.from(BUCKET)
      .upload(`anon-${Date.now()}.gif`, pixel);
    const asMember = await member.client
      .storage.from(BUCKET)
      .upload(`member-${Date.now()}.gif`, pixel);

    expect(asAnon.error).not.toBeNull();
    expect(asMember.error).not.toBeNull();
  });

  it("accepts an upload from an admin and serves it publicly", async () => {
    const path = `admin-${Date.now()}.gif`;

    const upload = await admin.client.storage.from(BUCKET).upload(path, pixel);
    expect(upload.error).toBeNull();

    const { data } = admin.client.storage.from(BUCKET).getPublicUrl(path);
    const response = await fetch(data.publicUrl);
    expect(response.status).toBe(200);

    await serviceClient().storage.from(BUCKET).remove([path]);
  });

  it("refuses a non-image upload from an admin", async () => {
    const { error } = await admin.client
      .storage.from(BUCKET)
      .upload(`admin-${Date.now()}.pdf`, new Blob(["not an image"], {
        type: "application/pdf",
      }));

    expect(error).not.toBeNull();
  });
});
