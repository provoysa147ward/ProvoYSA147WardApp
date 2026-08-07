import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  INITIAL_SUBMIT_STATE,
  type SubmitState,
} from "@/app/submit/submit-state";
import { wardToday } from "@/lib/date";

// The form imports a server action. Replace the module outright rather than
// spreading the original: `actions.ts` pulls in `server-only`, which throws the
// moment it is loaded in this jsdom environment. The action's own behaviour is
// covered by the DB and E2E suites.
const submitEvent = vi.hoisted(() => vi.fn());
vi.mock("@/app/submit/actions", () => ({ submitEvent }));

let currentState: SubmitState = INITIAL_SUBMIT_STATE;
const formAction = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: () => [currentState, formAction, false],
  };
});

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, useFormStatus: () => ({ pending: false }) };
});

const { SubmitEventForm } = await import("./SubmitEventForm");

beforeEach(() => {
  currentState = INITIAL_SUBMIT_STATE;
});

afterEach(() => {
  vi.clearAllMocks();
});

// Real timers throughout: userEvent's internal delays deadlock against fake
// ones, and the only clock-dependent assertion just compares against the same
// `wardToday()` the component calls.
const user = () => userEvent.setup();

describe("the submission form", () => {
  it("renders every field a submitter needs", () => {
    render(<SubmitEventForm />);

    expect(screen.getByLabelText(/What is it\?/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Date/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/End time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Where\?/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email or phone/)).toBeInTheDocument();
  });

  it("offers every category", () => {
    render(<SubmitEventForm />);

    const select = screen.getByLabelText(/Category/);
    const values = [...select.querySelectorAll("option")].map((o) => o.value);
    expect(values).toEqual([
      "",
      "sports",
      "spiritual",
      "social",
      "service",
      "other",
    ]);
  });

  it("stops the date picker from offering past dates", () => {
    render(<SubmitEventForm />);
    expect(screen.getByLabelText(/^Date/)).toHaveAttribute("min", wardToday());
  });

  it("says plainly that contact details stay private", () => {
    render(<SubmitEventForm />);
    expect(
      screen.getByText(/never appears on the public calendar/),
    ).toBeInTheDocument();
  });

  it("explains how past-midnight end times work", () => {
    render(<SubmitEventForm />);
    expect(screen.getByText(/Ends after midnight\?/)).toBeInTheDocument();
  });
});

describe("the weekly repeat disclosure", () => {
  it("hides the until-date until repeating is switched on", async () => {
    render(<SubmitEventForm />);

    expect(screen.queryByLabelText(/Repeat until/)).not.toBeInTheDocument();

    await user().click(screen.getByLabelText(/Every week/));

    expect(screen.getByLabelText(/Repeat until/)).toBeInTheDocument();
  });

  it("shows the skip-a-week workaround where the admin will look for it", async () => {
    render(<SubmitEventForm />);
    await user().click(screen.getByLabelText(/Every week/));

    expect(screen.getByText(/Need to skip a week\?/)).toBeInTheDocument();
  });

  it("caps the picker at today or later", async () => {
    render(<SubmitEventForm />);
    await user().click(screen.getByLabelText(/Every week/));

    expect(screen.getByLabelText(/Repeat until/)).toHaveAttribute(
      "min",
      wardToday(),
    );
  });
});

describe("the honeypot", () => {
  it("is hidden from assistive technology and the tab order", () => {
    const { container } = render(<SubmitEventForm />);

    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).toBeInTheDocument();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("is absent from the accessibility tree, so no screen-reader user can trip it", () => {
    render(<SubmitEventForm />);
    // Role queries honour aria-hidden; label queries do not, which is exactly
    // the distinction that matters here.
    expect(
      screen.queryByRole("textbox", { name: /Website/ }),
    ).not.toBeInTheDocument();
  });
});

describe("inline errors", () => {
  it("shows a field error and marks the input invalid", () => {
    currentState = {
      status: "error",
      errors: { title: "Title is required." },
    };

    render(<SubmitEventForm />);

    expect(screen.getByRole("alert")).toHaveTextContent("Title is required.");
    expect(screen.getByLabelText(/What is it\?/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("links the error to its input via aria-describedby", () => {
    currentState = {
      status: "error",
      errors: { location: "Location is required." },
    };

    render(<SubmitEventForm />);

    const input = screen.getByLabelText(/Where\?/);
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Location is required.",
    );
  });

  it("shows a form-level error when the problem isn't one field", () => {
    currentState = {
      status: "error",
      errors: {},
      formError: "That's a lot of suggestions at once!",
    };

    render(<SubmitEventForm />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That's a lot of suggestions at once!",
    );
  });
});

describe("the confirmation screen", () => {
  beforeEach(() => {
    currentState = { status: "success", errors: {} };
  });

  it("replaces the form once the suggestion is in", () => {
    render(<SubmitEventForm />);

    expect(screen.queryByLabelText(/What is it\?/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Thanks — we got it!/ }),
    ).toBeInTheDocument();
  });

  it("sets the expectation that an admin reviews it first", () => {
    render(<SubmitEventForm />);
    expect(
      screen.getByText(/Approved events appear on the calendar/),
    ).toBeInTheDocument();
  });

  it("offers a way onward", () => {
    render(<SubmitEventForm />);
    expect(
      screen.getByRole("link", { name: /Back to the calendar/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Suggest another/ }),
    ).toBeInTheDocument();
  });
});
