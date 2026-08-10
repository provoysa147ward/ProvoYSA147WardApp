"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { guardMessage } from "@/lib/adminActionSupport";
import { fieldErrors } from "@/lib/validation/fieldErrors";
import { createClient, requireAdmin } from "@/lib/supabase/server";
import { adminEmailSchema } from "@/lib/validation/admin";

import type { AdminActionState } from "../action-state";

export async function addAdminEmail(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const parsed = adminEmailSchema.safeParse({
    email: formData.get("email") ?? "",
  });

  if (!parsed.success) {
    return { status: "error", errors: fieldErrors(parsed.error.issues) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_emails")
    .insert({ email: parsed.data.email });

  if (error) {
    // 23505 is a duplicate key: already an admin, which is not a failure worth
    // alarming anyone about.
    if (error.code === "23505") {
      return {
        status: "success",
        errors: {},
        message: `${parsed.data.email} is already an admin.`,
      };
    }
    return {
      status: "error",
      errors: {},
      formError: `Could not add that address: ${error.message}`,
    };
  }

  revalidatePath("/admin/admins");
  return {
    status: "success",
    errors: {},
    message: `${parsed.data.email} can now sign in at /admin.`,
  };
}

/**
 * Remove an admin.
 *
 * The ward's permanent row is protected by a database trigger, not by this
 * function — the UI hides its remove button, but the trigger is what makes the
 * guarantee true even against a direct API call. This just reports it kindly.
 */
export async function removeAdminEmail(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    return { status: "error", errors: {}, formError: guardMessage(error) };
  }

  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_emails")
    .delete()
    .eq("email", email);

  if (error) {
    // Only the trigger raises restrict_violation. Reporting every failure as
    // the permanent-admin guard would tell an admin something false and stop
    // them retrying what was really a transient error.
    const isPermanentGuard = error.code === "23001";
    return {
      status: "error",
      errors: {},
      formError: isPermanentGuard
        ? "That address can't be removed — it's the ward's permanent admin, kept so nobody can lock everyone out."
        : `Could not remove that address: ${error.message}`,
    };
  }

  // Removing yourself takes effect immediately, so there is no admin page left
  // to show a success message on. Sign out and say what happened, rather than
  // re-rendering into a bare 403.
  if (email === admin.email) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=removed-self");
  }

  revalidatePath("/admin/admins");
  return { status: "success", errors: {}, message: `${email} removed.` };
}
