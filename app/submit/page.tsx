import type { Metadata } from "next";

import { SubmitEventForm } from "@/components/forms/SubmitEventForm";

export const metadata: Metadata = {
  title: "Suggest an Event",
  description:
    "Tell the Provo YSA 147th Ward about something happening. An admin reviews every suggestion.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suggest an event</h1>
        <p className="mt-2 text-ink-muted">
          Anyone can suggest something — no account needed. An admin reviews it
          before it shows up on the calendar.
        </p>
      </div>

      <SubmitEventForm />
    </div>
  );
}
