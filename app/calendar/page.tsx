import type { Metadata } from "next";

import { CalendarView } from "@/components/calendar/CalendarView";
import { ButtonLink } from "@/components/ui/Button";
import { monthOf, parseMonthParam, wardToday } from "@/lib/date";
import { getPublicEvents } from "@/lib/queries";

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

  const events = await getPublicEvents();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
        <ButtonLink href="/submit">Suggest an event</ButtonLink>
      </div>

      <CalendarView events={events} month={month} today={today} />
    </div>
  );
}
