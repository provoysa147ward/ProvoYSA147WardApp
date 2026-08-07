import { AdminListManager } from "@/components/admin/AdminListManager";
import { createClient, requireAdmin } from "@/lib/supabase/server";

export default async function AdminAdminsPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_emails")
    .select("email, is_permanent")
    .order("is_permanent", { ascending: false })
    .order("email", { ascending: true });

  if (error) throw new Error(`Could not load the admin list: ${error.message}`);

  const admins = (data ?? []).map((row) => ({
    email: row.email,
    isPermanent: row.is_permanent,
  }));

  return <AdminListManager admins={admins} currentEmail={admin.email} />;
}
