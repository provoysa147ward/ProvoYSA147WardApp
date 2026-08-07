"use server";

import { revalidatePath } from "next/cache";

import { fieldErrors, guardMessage } from "@/lib/adminActionSupport";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { groupSchema } from "@/lib/validation/admin";

import type { AdminActionState } from "../action-state";

const PHOTO_BUCKET = "group-photos";

function revalidateGroups() {
  revalidatePath("/groups");
  revalidatePath("/admin/groups");
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

  const photo = await uploadPhoto(formData.get("photo") as File | null);
  if (photo && "error" in photo) {
    return { status: "error", errors: {}, formError: photo.error };
  }
  if (photo) raw.photoUrl = photo.url;

  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

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
  const { error } = id
    ? await supabase.from("groups").update(row).eq("id", id)
    : await supabase.from("groups").insert(row);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not save that: ${error.message}`,
    };
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
  const { error } = await supabase
    .from("groups")
    .delete()
    .eq("id", String(formData.get("id") ?? ""));

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not delete that: ${error.message}`,
    };
  }

  revalidateGroups();
  return { status: "success", errors: {}, message: "Group deleted." };
}
