"use server";

import { revalidatePath } from "next/cache";

import { guardMessage } from "@/lib/adminActionSupport";
import { fieldErrors } from "@/lib/validation/fieldErrors";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { quickLinkSchema, siteSettingsSchema } from "@/lib/validation/admin";

import type { AdminActionState } from "../action-state";

function revalidateContent() {
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function saveSiteSettings(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const parsed = siteSettingsSchema.safeParse({
    welcomeBlurb: formData.get("welcomeBlurb") ?? "",
    sundayMeetingInfo: formData.get("sundayMeetingInfo") ?? "",
    announcement: formData.get("announcement") ?? "",
    announcementExpires: formData.get("announcementExpires") ?? "",
    contactName: formData.get("contactName") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({
      welcome_blurb: parsed.data.welcomeBlurb,
      sunday_meeting_info: parsed.data.sundayMeetingInfo,
      announcement: parsed.data.announcement,
      announcement_expires: parsed.data.announcementExpires,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail,
      contact_phone: parsed.data.contactPhone,
    })
    .eq("id", 1);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not save that: ${error.message}`,
    };
  }

  revalidateContent();
  return { status: "success", errors: {}, message: "Saved." };
}

export async function saveQuickLink(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const parsed = quickLinkSchema.safeParse({
    label: formData.get("label") ?? "",
    url: formData.get("url") ?? "",
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const row = {
    label: parsed.data.label,
    url: parsed.data.url,
    sort_order: parsed.data.sortOrder,
  };

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("quick_links").update(row).eq("id", id)
    : await supabase.from("quick_links").insert(row);

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not save that: ${error.message}`,
    };
  }

  revalidateContent();
  return { status: "success", errors: {}, message: id ? "Link saved." : "Link added." };
}

export async function deleteQuickLink(
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
    .from("quick_links")
    .delete()
    .eq("id", String(formData.get("id") ?? ""));

  if (error) {
    return {
      status: "error",
      errors: {},
      formError: `Could not delete that: ${error.message}`,
    };
  }

  revalidateContent();
  return { status: "success", errors: {}, message: "Link deleted." };
}
