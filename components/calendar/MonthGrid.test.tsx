import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { occurrencesInRange, type WardEvent } from "@/lib/events";
import { monthGridRange } from "@/lib/date";

import { MAX_CHIPS_PER_DAY, MonthGrid } from "./MonthGrid";

const AUGUST_2026 = { year: 2026, month: 8 };
const TODAY = "2026-08-07";

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Volleyball",
    category: "sports",
    eventDate: "2026-08-11",
    startTime: "20:00",
    endTime: "22:00",
    location: "Stake center gym",
    description: null,
    allDay: false,
    ...overrides,
  };
}

function renderGrid(events: WardEvent[], onSelect = vi.fn()) {
  render(
    <MonthGrid
      month={AUGUST_2026}
      occurrences={occurrencesInRange(events, monthGridRange(AUGUST_2026))}
      onSelect={onSelect}
      today={TODAY}
    />,
  );
  return { onSelect };
}

describe("MonthGrid", () => {
  it("renders a weekday header row", () => {
    renderGrid([]);

    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(7);
    expect(headers[0]).toHaveTextContent("Sun");
    expect(headers[6]).toHaveTextContent("Sat");
  });

  it("covers the month in whole weeks", () => {
    renderGrid([]);

    // August 2026 starts on a Saturday and has 31 days: 6 rows.
    expect(screen.getAllByRole("row")).toHaveLength(7); // 6 weeks + header
  });

  it("marks today", () => {
    renderGrid([]);
    expect(screen.getByText("(today)", { exact: false })).toBeInTheDocument();
  });

  it("places an event in its day cell", () => {
    renderGrid([makeEvent()]);
    expect(screen.getByText("Volleyball")).toBeInTheDocument();
  });

  it("renders each instance of a repeating event in its own cell", () => {
    renderGrid(
      ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25"].map(
        (eventDate) => makeEvent({ eventDate }),
      ),
    );

    expect(screen.getAllByText("Volleyball")).toHaveLength(4);
  });

  it("announces the category to screen readers, not by colour alone", () => {
    renderGrid([makeEvent({ category: "service" })]);
    expect(screen.getByText("Service:")).toBeInTheDocument();
  });

  it(`shows at most ${MAX_CHIPS_PER_DAY} chips and collapses the rest`, async () => {
    const sameDay = Array.from({ length: 5 }, (_, index) =>
      makeEvent({
        id: `event-${index}`,
        title: `Event ${index}`,
        eventDate: "2026-08-11",
        startTime: `1${index}:00`,
      }),
    );

    const { onSelect } = renderGrid(sameDay);

    expect(screen.getByText("Event 0")).toBeInTheDocument();
    expect(screen.queryByText("Event 4")).not.toBeInTheDocument();

    const more = screen.getByRole("button", { name: "+2 more" });
    await userEvent.click(more);

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-08-11",
        occurrences: expect.arrayContaining([
          expect.objectContaining({ key: "event-4@2026-08-11" }),
        ]),
      }),
    );
  });

  it("selects a single event when its chip is clicked", async () => {
    const { onSelect } = renderGrid([makeEvent()]);

    await userEvent.click(screen.getByRole("button", { name: /Volleyball/ }));

    expect(onSelect).toHaveBeenCalledWith({
      date: "2026-08-11",
      occurrences: [expect.objectContaining({ key: "event-1@2026-08-11" })],
    });
  });

  it("shows neighbouring-month days but keeps them visually secondary", () => {
    renderGrid([]);

    // 26 July fills the first row alongside 1 August.
    const rows = screen.getAllByRole("row");
    const firstWeek = within(rows[1]).getAllByRole("cell");
    expect(firstWeek).toHaveLength(7);
    expect(firstWeek[0]).toHaveTextContent("26");
  });

  it("renders an event that runs past midnight on its start day only", () => {
    renderGrid([
      makeEvent({ eventDate: "2026-08-11", startTime: "22:00", endTime: "00:30" }),
    ]);

    expect(screen.getAllByText("Volleyball")).toHaveLength(1);
  });

  it("renders an empty month without any event chips", () => {
    renderGrid([makeEvent({ eventDate: "2026-12-01" })]);
    expect(screen.queryByText("Volleyball")).not.toBeInTheDocument();
  });
});
