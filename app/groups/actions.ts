"use server";

import { revalidatePath } from "next/cache";

import { guardMessage } from "@/lib/adminActionSupport";
import type { AdminActionState } from "@/lib/adminActionState";
import { fieldErrors } from "@/lib/validation/fieldErrors";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { groupSchema } from "@/lib/validation/admin";

/**
 * The group mutations, which sit beside the public page that renders their
 * forms rather than inside the `(protected)` route group.
 *
 * That costs nothing in safety: a server action is an independently-invocable
 * POST endpoint, so the layout it renders under never guarded it — the
 * `requireAdmin()` call at the top of each action and RLS underneath are what
 * do, and both are unchanged.
 */

const PHOTO_BUCKET = "group-photos";

/** The message for a row that another admin deleted while this one was editing. */
const VANISHED = "That group no longer exists — reload the page.";

function revalidateGroups() {
  revalidatePath("/groups");
}

function readGroupForm(formData: FormData) {
  return {
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    emoji: formData.get("emoji") ?? "",
    photoUrl: formData.get("photoUrl") ?? "",
    meetingInfo: formData.get("meetingInfo") ?? "",
    groupmeUrl: formData.get("groupmeUrl") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  };
}

/**
 * Upload a group photo, if one was chosen.
 *
 * No size or type check here on purpose: the bucket enforces a 2 MB cap and an
 * image-only mime allowlist, so a client-side check would only be a second
 * place to get it wrong. A rejected upload surfaces as a form error.
 */
async function uploadPhoto(
  file: File | null,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;

  const supabase = await createClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return {
      error:
        "That image wouldn't upload. It needs to be a JPEG, PNG, WebP or GIF under 2 MB.",
    };
  }

  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function saveGroup(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const raw = readGroupForm(formData);

  // Validate first. Uploading before this would leave an orphaned object in the
  // bucket every time a submission is rejected.
  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const chosen = formData.get("photo");
  const photo = await uploadPhoto(chosen instanceof File ? chosen : null);
  if (photo && "error" in photo) {
    return { status: "error", errors: {}, formError: photo.error };
  }
  if (photo) parsed.data.photoUrl = photo.url;

  const row = {
    name: parsed.data.name,
    description: parsed.data.description,
    emoji: parsed.data.emoji,
    photo_url: parsed.data.photoUrl,
    meeting_info: parsed.data.meetingInfo,
    groupme_url: parsed.data.groupmeUrl,
    sort_order: parsed.data.sortOrder,
  };

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  // `.select("id")` on the update so a write that matched nothing can be told
  // apart from a write that landed: without it PostgREST reports success for
  // a row another admin has already deleted.
  const { data, error } = id
    ? await supabase.from("groups").update(row).eq("id", id).select("id")
    : await supabase.from("groups").insert(row).select("id");

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not save that: ${error.message}`,
    };
  }

  if (id && (data ?? []).length === 0) {
    return { status: "error", errors: {}, formError: VANISHED };
  }

  revalidateGroups();
  return {
    status: "success",
    errors: {},
    message: id ? "Group saved." : "Group added.",
  };
}

export async function deleteGroup(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .select("id");

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not delete that: ${error.message}`,
    };
  }

  if ((data ?? []).length === 0) {
    return { status: "error", errors: {}, formError: VANISHED };
  }

  revalidateGroups();
  return { status: "success", errors: {}, message: "Group deleted." };
}
