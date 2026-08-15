import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { occurrencesInRange, type WardEvent } from "@/lib/events";

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
    ...overrides,
  };
}

function selectionFor(event: WardEvent) {
  const occurrences = occurrencesInRange([event], {
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

  it("says so for an all-day event, instead of a clock time", () => {
    render(
      <EventDetailCard
        selection={selectionFor(
          makeEvent({ startTime: "00:00", endTime: null, allDay: true }),
        )}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("omits the location block when the event has none", () => {
    render(
      <EventDetailCard
        selection={selectionFor(makeEvent({ location: "" }))}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByText("Where")).not.toBeInTheDocument();
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
    const first = occurrencesInRange([makeEvent()], {
      from: "2026-08-01",
      to: "2026-08-31",
    })[0];
    const second = occurrencesInRange(
      [makeEvent({ id: "event-2", title: "Evening Devotional", startTime: "19:00" })],
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

  it("points the Add to Google Calendar link at the right instants", () => {
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={vi.fn()} />,
    );

    const href = screen
      .getByRole("link", { name: /Add to Google Calendar/ })
      .getAttribute("href");
    const dates = new URL(href!).searchParams.get("dates");

    // 1 PM to 3 PM on 9 August 2026, Denver time (UTC-6 in summer).
    expect(dates).toBe("20260809T190000Z/20260809T210000Z");
  });

  it("points it at a date range for an all-day event", () => {
    render(
      <EventDetailCard
        selection={selectionFor(
          makeEvent({ startTime: "00:00", endTime: null, allDay: true }),
        )}
        onClose={vi.fn()}
      />,
    );

    const href = screen
      .getByRole("link", { name: /Add to Google Calendar/ })
      .getAttribute("href");

    expect(new URL(href!).searchParams.get("dates")).toBe("20260809/20260810");
  });

  it("closes when the close button is pressed", async () => {
    const onClose = vi.fn();
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={onClose} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("never renders anybody's contact — the mapping never carries it", () => {
    render(
      <EventDetailCard selection={selectionFor(makeEvent())} onClose={vi.fn()} />,
    );

    const html = document.body.innerHTML;
    expect(html).not.toMatch(/submitter/i);
    expect(html).not.toMatch(/@example\.com/);
  });
});
