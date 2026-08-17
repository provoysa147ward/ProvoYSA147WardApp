"use server";

import { revalidatePath } from "next/cache";

import { guardMessage } from "@/lib/adminActionSupport";
import type { AdminActionState } from "@/lib/adminActionState";
import { fieldErrors } from "@/lib/validation/fieldErrors";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { quickLinkSchema } from "@/lib/validation/admin";

/**
 * The quick-link mutations, which now sit beside the dashboard that renders
 * them: the separate `/admin/content` screen they used to live on is gone,
 * along with the site-settings form that was the rest of it.
 */

function revalidateQuickLinks() {
  revalidatePath("/");
  revalidatePath("/admin");
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

  revalidateQuickLinks();
  return {
    status: "success",
    errors: {},
    message: id ? "Link saved." : "Link added.",
  };
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

  revalidateQuickLinks();
  return { status: "success", errors: {}, message: "Link deleted." };
}
