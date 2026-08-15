import type { Metadata } from "next";

import { CalendarView } from "@/components/calendar/CalendarView";
import { EventsUnavailable } from "@/components/calendar/EventsUnavailable";
import {
  formatMonthParam,
  monthOf,
  parseMonthParam,
  wardToday,
} from "@/lib/date";
import { getCalendarEvents } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Calendar",
  description: "Everything happening in the Provo YSA 147th Ward.",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = wardToday();
  const month = parseMonthParam(monthParam, monthOf(today));

  const calendar = await getCalendarEvents();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>

      {calendar.ok ? (
        // Keyed on the month so navigating `?month=` starts the view fresh:
        // the day/week anchor and any open detail dialog belong to the month
        // they were opened in, and a soft navigation would otherwise keep them.
        <CalendarView
          key={formatMonthParam(month)}
          events={calendar.events}
          month={month}
          today={today}
          hasMonthParam={monthParam !== undefined}
        />
      ) : (
        <EventsUnavailable />
      )}
    </div>
  );
}
