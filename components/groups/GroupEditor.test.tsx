import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminActionState } from "@/lib/adminActionState";
import type { Group } from "@/lib/queries";

/**
 * The editor's whole job is deciding when the dialog is open and what state it
 * carries, so that is what is tested here. The actions themselves are mocked:
 * they are `"use server"` modules that reach Supabase, and jsdom cannot run
 * them — what matters on this side is what the component does with the state
 * they return.
 */

const saveGroup = vi.fn<(previous: AdminActionState, formData: FormData) => Promise<AdminActionState>>();
const deleteGroup = vi.fn<(previous: AdminActionState, formData: FormData) => Promise<AdminActionState>>();

vi.mock("@/app/groups/actions", () => ({
  saveGroup: (previous: AdminActionState, formData: FormData) =>
    saveGroup(previous, formData),
  deleteGroup: (previous: AdminActionState, formData: FormData) =>
    deleteGroup(previous, formData),
}));

// A static import is safe here: Vitest hoists `vi.mock` above every import, so
// the mock is registered before this module resolves its own dependencies.
import { AddGroupButton, GroupCardControls, GroupEditor } from "./GroupEditor";

// jsdom does not implement the modal dialog methods.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  saveGroup.mockResolvedValue({ status: "success", errors: {}, message: "Group saved." });
  deleteGroup.mockResolvedValue({ status: "success", errors: {}, message: "Group deleted." });
});

const GROUP: Group = {
  id: "group-1",
  name: "Volleyball",
  description: "Pickup games every week.",
  emoji: "🏐",
  // A real photo URL, not null: the form carries this in a hidden input, and
  // that input is the only thing stopping an edit from blanking the photo.
  photoUrl: "https://cdn.example.com/volleyball.png",
  meetingInfo: "Tuesdays 8:00 PM · Stake center gym",
  groupmeUrl: "https://groupme.com/join_group/123",
  sortOrder: 3,
};

const openEditor = async (name: RegExp | string) => {
  await userEvent.click(screen.getByRole("button", { name }));
};

describe("GroupEditor", () => {
  it("keeps the form out of the document until the dialog is opened", () => {
    render(<GroupEditor group={GROUP} />);

    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });

  it("fills the fields from the group being edited", async () => {
    render(<GroupEditor group={GROUP} />);
    await openEditor(/Edit/);

    expect(screen.getByLabelText(/^Name/)).toHaveValue("Volleyball");
    expect(screen.getByLabelText(/^Description/)).toHaveValue(
      "Pickup games every week.",
    );
    expect(screen.getByLabelText(/^Emoji/)).toHaveValue("🏐");
    expect(screen.getByLabelText(/^Order/)).toHaveValue(3);
    expect(screen.getByLabelText(/^When and where/)).toHaveValue(
      "Tuesdays 8:00 PM · Stake center gym",
    );
    expect(screen.getByLabelText(/^GroupMe link/)).toHaveValue(
      "https://groupme.com/join_group/123",
    );
    // The id rides along so the action updates rather than inserts.
    expect(
      document.querySelector('input[name="id"]'),
    ).toHaveValue("group-1");
  });

  it("carries the existing photo through, so editing does not blank it", async () => {
    render(<GroupEditor group={GROUP} />);
    // The file input is necessarily empty on reopen — a chosen file cannot be
    // restored — so this hidden field is what preserves an existing photo
    // through an edit that does not touch it.
    await openEditor(/Edit/);

    expect(document.querySelector('input[name="photoUrl"]')).toHaveValue(
      "https://cdn.example.com/volleyball.png",
    );
  });

  it("opens an empty form when there is no group to edit", async () => {
    render(<AddGroupButton />);
    await openEditor("Add group");

    expect(screen.getByLabelText(/^Name/)).toHaveValue("");
    expect(document.querySelector('input[name="id"]')).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Add a group" }),
    ).toBeInTheDocument();
  });

  it("submits the add flow with no id, so the action inserts", async () => {
    saveGroup.mockResolvedValue({
      status: "success",
      errors: {},
      message: "Group added.",
    });

    render(<AddGroupButton />);
    await openEditor("Add group");
    // Both are `required`, so the browser refuses to submit until they are
    // filled — the add flow starts empty where the edit flow starts populated.
    await userEvent.type(screen.getByLabelText(/^Name/), "Pickleball");
    await userEvent.type(
      screen.getByLabelText(/^Description/),
      "Weeknight games.",
    );
    // Scoped to the dialog: the trigger that opened it is also "Add group".
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Add group",
      }),
    );

    await waitFor(() => expect(saveGroup).toHaveBeenCalledTimes(1));
    const submitted = saveGroup.mock.calls[0][1];
    // An id is what makes the action update instead of insert, so its absence
    // is the whole difference between the two flows.
    expect(submitted.get("id")).toBeNull();
    expect(submitted.get("name")).toBe("Pickleball");
    expect(screen.getByRole("status")).toHaveTextContent("Group added.");
  });

  it("closes on Cancel without calling the action", async () => {
    render(<GroupEditor group={GROUP} />);
    await openEditor(/Edit/);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
    expect(saveGroup).not.toHaveBeenCalled();
  });

  it("closes itself on a successful save and announces it", async () => {
    render(<GroupEditor group={GROUP} />);
    await openEditor(/Edit/);

    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument(),
    );
    expect(saveGroup).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Group saved.");
  });

  it("stays open on an error, showing the message", async () => {
    saveGroup.mockResolvedValue({
      status: "error",
      errors: { name: "Group name is required." },
      formError: "That group no longer exists — reload the page.",
    });

    render(<GroupEditor group={GROUP} />);
    await openEditor(/Edit/);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const formError = await screen.findByText(
      "That group no longer exists — reload the page.",
    );
    expect(formError).toHaveAttribute("role", "alert");
    // Still open, still holding what was typed, with the field error on it.
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();
    expect(screen.getByText("Group name is required.")).toBeInTheDocument();
  });

  it("starts fresh when reopened after an error", async () => {
    saveGroup.mockResolvedValue({
      status: "error",
      errors: { name: "Group name is required." },
      formError: "Could not save that: boom",
    });

    render(<GroupEditor group={GROUP} />);
    await openEditor(/Edit/);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("Could not save that: boom");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await openEditor(/Edit/);

    expect(screen.queryByText("Could not save that: boom")).not.toBeInTheDocument();
    expect(screen.queryByText("Group name is required.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Volleyball");
  });
});

describe("GroupCardControls", () => {
  it("offers Edit and Delete for the group", () => {
    render(<GroupCardControls group={GROUP} />);

    // The card's Edit control names the group it edits, so a screen reader
    // moving between cards can tell one from the next.
    expect(
      screen.getByRole("button", { name: /Edit\s+Volleyball/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("reports a failed delete in the controls row", async () => {
    deleteGroup.mockResolvedValue({
      status: "error",
      errors: {},
      formError: "That group no longer exists — reload the page.",
    });

    render(<GroupCardControls group={GROUP} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("That group no longer exists — reload the page.");
    expect(deleteGroup).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the delete works", async () => {
    // Deliberately paired with the failure case above: that one proves an alert
    // can appear at all, so this one's absence means something. Without waiting
    // for the action to settle first, it would pass even if the component
    // never rendered alerts.
    const settled = Promise.withResolvers<AdminActionState>();
    deleteGroup.mockReturnValue(settled.promise);

    render(<GroupCardControls group={GROUP} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));

    settled.resolve({ status: "success", errors: {}, message: "Group deleted." });
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledTimes(1));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
