import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { expandEvent, type WardEvent } from "@/lib/events";

import { EventDetailCard } from "./EventDetailCard";

// jsdom does not implement the modal dialog methods.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Break the Fast",
    category: "social",
    eventDate: "2026-08-09",
    startTime: "13:00",
    endTime: "15:00",
    location: "Cultural hall",
    description: "Bring a side if you can.",
    allDay: false,
    repeatsWeekly: false,
    repeatUntil: null,
    ...overrides,
  };
}

function selectionFor(event: WardEvent) {
  const occurrences = expandEvent(event, {
    from: "2026-08-01",
    to: "2026-12-31",
  });
  return { date: occurrences[0].date, occurrences: [occurrences[0]] };
}

describe("EventDetailCard", () => {
  it("renders nothing when there is no selection", () => {
    render(<EventDetailCard selection={null} onClose={vi.fn()} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("shows the event's title, time, location, and description", () => {
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: "Break the Fast" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1:00 PM – 3:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Cultural hall")).toBeInTheDocument();
    expect(screen.getByText("Bring a side if you can.")).toBeInTheDocument();
  });

  it("shows the day the occurrence falls on", () => {
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={vi.fn()} />,
    );
    expect(screen.getByText("Sunday, August 9")).toBeInTheDocument();
  });

  it("describes a weekly series and when it stops", () => {
    render(
      <EventDetailCard
        selection={selectionFor(
          makeEvent({ repeatsWeekly: true, repeatUntil: "2026-09-27" }),
        )}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText(/Weekly until September 27, 2026/)).toBeInTheDocument();
  });

  it("flags an event that runs past midnight", () => {
    render(
      <EventDetailCard
        selection={selectionFor(
          makeEvent({ startTime: "21:30", endTime: "00:30" }),
        )}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("9:30 PM – 12:30 AM (next day)")).toBeInTheDocument();
  });

  it("omits the description block when there is none", () => {
    render(
      <EventDetailCard
        selection={selectionFor(makeEvent({ description: null }))}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Bring a side/)).not.toBeInTheDocument();
  });

  it("lists every event when a whole day is selected", () => {
    const first = expandEvent(makeEvent(), {
      from: "2026-08-01",
      to: "2026-08-31",
    })[0];
    const second = expandEvent(
      makeEvent({ id: "event-2", title: "Evening Devotional", startTime: "19:00" }),
      { from: "2026-08-01", to: "2026-08-31" },
    )[0];

    render(
      <EventDetailCard
        selection={{ date: "2026-08-09", occurrences: [first, second] }}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Break the Fast" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evening Devotional" }),
    ).toBeInTheDocument();
  });

  it("closes when the close button is pressed", async () => {
    const onClose = vi.fn();
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("never renders submitter details — they are not in the public data", () => {
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={vi.fn()} />,
    );

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/submitter/i);
    expect(html).not.toMatch(/@example\.com/);
  });
});
