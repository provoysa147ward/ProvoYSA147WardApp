import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { occurrencesInRange, type WardEvent } from "@/lib/events";

import { AgendaList } from "./AgendaList";

const TODAY = "2026-08-07";
const RANGE = { from: TODAY, to: "2026-09-30" };

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Institute",
    category: "temple",
    eventDate: "2026-08-12",
    startTime: "19:00",
    endTime: "20:30",
    location: "Institute building",
    description: null,
    allDay: false,
    ...overrides,
  };
}

function renderAgenda(events: WardEvent[], onSelect = vi.fn()) {
  render(
    <AgendaList
      occurrences={occurrencesInRange(events, RANGE)}
      onSelect={onSelect}
      today={TODAY}
    />,
  );
  return { onSelect };
}

describe("AgendaList", () => {
  it("shows a friendly empty state when nothing is scheduled", () => {
    renderAgenda([]);
    expect(
      screen.getByText("Nothing scheduled yet."),
    ).toBeInTheDocument();
  });

  it("groups events under a day heading", () => {
    renderAgenda([makeEvent()]);

    expect(
      screen.getByRole("heading", { name: /Wednesday, August 12/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Institute")).toBeInTheDocument();
  });

  it("labels the day heading with a machine-readable time element", () => {
    const { container } = render(
      <AgendaList
        occurrences={occurrencesInRange([makeEvent()], RANGE)}
        onSelect={vi.fn()}
        today={TODAY}
      />,
    );

    const dayTime = container.querySelector('time[datetime="2026-08-12"]');
    expect(dayTime).toHaveTextContent("Wednesday, August 12");
  });

  it("marks today's group", () => {
    renderAgenda([makeEvent({ eventDate: TODAY })]);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("lists occurrences in chronological order across days", () => {
    renderAgenda([
      makeEvent({ id: "later", title: "Later", eventDate: "2026-08-20" }),
      makeEvent({ id: "sooner", title: "Sooner", eventDate: "2026-08-10" }),
    ]);

    const titles = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(titles[0]).toContain("Sooner");
    expect(titles[1]).toContain("Later");
  });

  it("shows the time range and location", () => {
    renderAgenda([makeEvent()]);
    expect(
      screen.getByText(/7:00 PM – 8:30 PM/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Institute building/)).toBeInTheDocument();
  });

  it("flags an event that runs past midnight", () => {
    renderAgenda([makeEvent({ startTime: "21:30", endTime: "00:30" })]);
    expect(screen.getByText(/9:30 PM – 12:30 AM \(next day\)/)).toBeInTheDocument();
  });

  it("shows only a start time when there is no end time", () => {
    renderAgenda([makeEvent({ endTime: null })]);
    expect(screen.getByText("7:00 PM")).toBeInTheDocument();
    expect(screen.queryByText(/–/)).not.toBeInTheDocument();
  });

  it("lists a repeating event once per instance, as Google sends them", () => {
    renderAgenda(
      ["2026-08-12", "2026-08-19", "2026-08-26"].map((eventDate) =>
        makeEvent({ eventDate }),
      ),
    );

    expect(screen.getAllByText("Institute")).toHaveLength(3);
  });

  it("labels an all-day event instead of giving it a clock time", () => {
    renderAgenda([
      makeEvent({ startTime: "00:00", endTime: null, allDay: true }),
    ]);

    expect(screen.getByText("All day")).toBeInTheDocument();
  });

  it("selects the tapped occurrence", async () => {
    const { onSelect } = renderAgenda([makeEvent()]);

    await userEvent.click(screen.getByRole("button", { name: /Institute/ }));

    expect(onSelect).toHaveBeenCalledWith({
      date: "2026-08-12",
      occurrences: [expect.objectContaining({ key: "event-1@2026-08-12" })],
    });
  });

  it("names the category in text, not colour alone", () => {
    renderAgenda([makeEvent({ category: "service" })]);
    expect(screen.getByText("Service")).toBeInTheDocument();
  });
});
