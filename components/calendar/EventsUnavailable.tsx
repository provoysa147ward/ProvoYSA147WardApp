import { EmptyState } from "@/components/ui/EmptyState";

/**
 * What the events region shows when the ward's Google Calendar cannot be read.
 *
 * Deliberately not an error page: the rest of the site — groups, links,
 * announcements, admin — has nothing to do with Google and keeps working.
 */
export function EventsUnavailable() {
  return (
    <EmptyState emoji="🌥️" title="The calendar isn't loading right now.">
      Try again in a few minutes.
    </EmptyState>
  );
}
