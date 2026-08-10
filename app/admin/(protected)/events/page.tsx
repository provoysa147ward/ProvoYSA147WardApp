import { EventManager } from "@/components/admin/EventManager";
import { getEventsByStatus } from "@/lib/adminQueries";

export default async function AdminEventsPage() {
  const [approved, rejected] = await Promise.all([
    getEventsByStatus("approved"),
    getEventsByStatus("rejected"),
  ]);

  return <EventManager approved={approved} rejected={rejected} />;
}
