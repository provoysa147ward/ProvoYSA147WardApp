import { PendingQueue } from "@/components/admin/PendingQueue";
import { ButtonLink } from "@/components/ui/Button";
import { getPendingEvents } from "@/lib/adminQueries";

export default async function AdminDashboard() {
  const pending = await getPendingEvents();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">
          Waiting for review
          {pending.length > 0 ? (
            <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-sm text-cream">
              {pending.length}
            </span>
          ) : null}
        </h2>
        <ButtonLink href="/admin/events">Add an event</ButtonLink>
      </div>

      <PendingQueue events={pending} />
    </div>
  );
}
