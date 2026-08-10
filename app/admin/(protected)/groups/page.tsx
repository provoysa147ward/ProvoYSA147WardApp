import { GroupManager } from "@/components/admin/GroupManager";
import { getGroups } from "@/lib/queries";

export default async function AdminGroupsPage() {
  const groups = await getGroups();
  return <GroupManager groups={groups} />;
}
