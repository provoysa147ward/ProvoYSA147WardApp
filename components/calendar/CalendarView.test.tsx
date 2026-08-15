import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WardEvent } from "@/lib/events";

import { CalendarView, VIEW_STORAGE_KEY } from "./CalendarView";

const AUGUST_2026 = { year: 2026, month: 8 };
/** A Wednesday, so "this week" has days on either side of it. */
const TODAY = "2026-08-19";

function makeEvent(overrides: Partial<WardEvent> = {}): WardEvent {
  return {
    id: "event-1",
    title: "Volleyball",
    category: "sports",
    eventDate: TODAY,
    startTime: "20:00",
    endTime: "22:00",
    location: "Stake center gym",
    description: null,
    allDay: false,
    ...overrides,
  };
}

const EVENTS: WardEvent[] = [
  makeEvent(),
  makeEvent({
    id: "event-2",
    title: "Temple night",
    category: "spiritual",
    eventDate: "2026-08-20",
  }),
  makeEvent({
    id: "event-3",
    title: "Service project",
    category: "service",
    // Outside both the August grid and the week containing TODAY.
    eventDate: "2026-09-12",
  }),
];

/** jsdom has no real layout, so the device default has to be dictated. */
function setDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderCalendar({ hasMonthParam = false } = {}) {
  render(
    <CalendarView
      events={EVENTS}
      month={AUGUST_2026}
      today={TODAY}
      hasMonthParam={hasMonthParam}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  setDesktop(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CalendarView", () => {
  it("offers all four views in one labelled group", () => {
    renderCalendar();

    const group = screen.getByRole("group", { name: "Calendar view" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Schedule", "Day", "Week", "Month"]);
  });

  it("defaults to the month grid on a desktop-width viewport", async () => {
    setDesktop(true);
    renderCalendar();

    expect(
      await screen.findByRole("button", { name: "Month", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("defaults to the schedule on a phone-width viewport", async () => {
    renderCalendar();

    expect(
      await screen.findByRole("button", { name: "Schedule", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("Service project")).toBeInTheDocument();
  });

  it("prefers a remembered view over the device default", async () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "week");
    renderCalendar();

    expect(
      await screen.findByRole("button", { name: "Week", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByText("Temple night")).toBeInTheDocument();
    // September is not in the week containing today.
    expect(screen.queryByText("Service project")).not.toBeInTheDocument();
  });

  it("falls back to the device default when the stored view is stale", async () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "timeline");
    setDesktop(true);
    renderCalendar();

    expect(
      await screen.findByRole("button", { name: "Month", pressed: true }),
    ).toBeInTheDocument();
  });

  it("remembers a chosen view", async () => {
    const user = userEvent.setup();
    renderCalendar();
    await screen.findByRole("button", { name: "Schedule", pressed: true });

    await user.click(screen.getByRole("button", { name: "Day" }));

    expect(
      screen.getByRole("button", { name: "Day", pressed: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Schedule", pressed: false }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(VIEW_STORAGE_KEY)).toBe("day");
  });

  it("forces the month view when the URL names a month", async () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "schedule");
    renderCalendar({ hasMonthParam: true });

    expect(
      await screen.findByRole("button", { name: "Month", pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("shows only the anchored day, and moves a day at a time", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(VIEW_STORAGE_KEY, "day");
    renderCalendar();

    await screen.findByRole("button", { name: "Day", pressed: true });
    expect(screen.getByText("Volleyball")).toBeInTheDocument();
    expect(screen.queryByText("Temple night")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next day" }));

    expect(screen.getByText("Temple night")).toBeInTheDocument();
    expect(screen.queryByText("Volleyball")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByText("Volleyball")).toBeInTheDocument();
  });

  it("empties out on a day with nothing on it, and Today comes back", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(VIEW_STORAGE_KEY, "day");
    renderCalendar();

    await screen.findByRole("button", { name: "Day", pressed: true });
    await user.click(screen.getByRole("button", { name: "Previous day" }));

    expect(
      screen.getByText("Nothing scheduled on Tuesday, August 18."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(screen.getByText("Volleyball")).toBeInTheDocument();
  });

  it("moves a week at a time, and says so in its heading", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(VIEW_STORAGE_KEY, "week");
    renderCalendar();

    expect(
      await screen.findByRole("heading", { name: "Aug 16 – 22, 2026" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next week" }));

    expect(
      screen.getByRole("heading", { name: "Aug 23 – 29, 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nothing scheduled this week."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "This week" }));
    expect(screen.getByText("Volleyball")).toBeInTheDocument();
  });

  it("survives a browser that refuses localStorage", async () => {
    const user = userEvent.setup();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("private mode");
      });
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("private mode");
      });

    renderCalendar();
    await screen.findByRole("button", { name: "Schedule", pressed: true });
    await user.click(screen.getByRole("button", { name: "Week" }));

    expect(
      screen.getByRole("button", { name: "Week", pressed: true }),
    ).toBeInTheDocument();

    setItem.mockRestore();
    getItem.mockRestore();
  });
});
