"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteGroup, saveGroup } from "@/app/groups/actions";
import {
  INITIAL_ADMIN_ACTION_STATE,
  type AdminActionState,
} from "@/lib/adminActionState";
import { Field, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Group } from "@/lib/queries";

/**
 * Editing groups where they are read, on the public `/groups` page.
 *
 * A modal rather than an inline expanding form: this is a card grid a visitor
 * also sees, and an open form in the middle of it would push the grid around.
 * Each card owns its own dialog, so one card's errors and pending state never
 * leak into another's.
 */

/** The "Add group" control, above the grid. One dialog, no group to edit. */
export function AddGroupButton() {
  return <GroupEditor trigger="Add group" />;
}

/**
 * The Edit and Delete pair on a single card.
 *
 * The delete failure lands here rather than in a form, because the confirm
 * dialog closes itself the moment the action is dispatched — if the message
 * lived inside it, nobody would ever read it.
 */
export function GroupCardControls({ group }: { group: Group }) {
  const [deleteState, deleteAction] = useActionState<AdminActionState, FormData>(
    deleteGroup,
    INITIAL_ADMIN_ACTION_STATE,
  );

  return (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <GroupEditor group={group} trigger="Edit" />
        <ConfirmDialog
          trigger="Delete"
          title={`Delete "${group.name}"?`}
          confirmLabel="Delete it"
          body="This removes the group from the site. It can't be undone."
          action={deleteAction}
        >
          <input type="hidden" name="id" value={group.id} />
        </ConfirmDialog>
      </div>

      {deleteState.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
        >
          {deleteState.formError}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The add/edit dialog. One component for both, because the field set is the
 * same and keeping two copies is how they drift apart.
 *
 * The shell stays mounted — it has to, to call `showModal()` — but the form
 * only renders while the dialog is open. Closing therefore throws away typed
 * values, field errors, and the action state together, so reopening starts
 * clean with no reset machinery to get wrong.
 */
export function GroupEditor({
  group,
  trigger,
}: {
  group?: Group;
  trigger: string;
}) {
  const [open, setOpen] = useState(false);
  // What the last successful save was, kept outside the dialog so it survives
  // the form unmounting and can still be announced.
  const [announcement, setAnnouncement] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  // A page holds one of these per card, so the heading id has to be unique or
  // every dialog's aria-labelledby resolves to the first one's title.
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      {/* The visible word is enough on screen — the card around it says which
          group. Out of that context it is one of several identical "Edit"
          buttons, so the accessible name carries the group's name too. */}
      <Button
        type="button"
        variant={group ? "secondary" : "primary"}
        aria-label={group ? `${trigger} ${group.name}` : undefined}
        onClick={() => {
          setAnnouncement("");
          setOpen(true);
        }}
      >
        {trigger}
      </Button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-labelledby={headingId}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        {open ? (
          <GroupForm
            group={group}
            headingId={headingId}
            onCancel={() => setOpen(false)}
            onSaved={(message) => {
              setAnnouncement(message);
              setOpen(false);
            }}
          />
        ) : null}
      </dialog>

      {/* The grid behind the dialog is the real confirmation; this is the same
          news for anyone who cannot see it re-render. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </>
  );
}

function GroupForm({
  group,
  headingId,
  onCancel,
  onSaved,
}: {
  group?: Group;
  headingId: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    saveGroup,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;

  // A save that worked needs no further reading: close, and let the revalidated
  // grid show the result. Anything else keeps the dialog open on its errors.
  useEffect(() => {
    if (state.status === "success") onSaved(state.message ?? "Group saved.");
  }, [state, onSaved]);

  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <h2 id={headingId} className="text-lg font-bold">
        {group ? `Edit ${group.name}` : "Add a group"}
      </h2>

      {group ? <input type="hidden" name="id" value={group.id} /> : null}

      {state.formError ? (
        <p
          role="alert"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
        >
          {state.formError}
        </p>
      ) : null}

      <Field id={fieldId("name")} label="Name" error={state.errors.name} required>
        {(props) => (
          <input
            {...props}
            name="name"
            type="text"
            maxLength={100}
            defaultValue={group?.name ?? ""}
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("description")}
        label="Description"
        error={state.errors.description}
        required
      >
        {(props) => (
          <textarea
            {...props}
            name="description"
            rows={2}
            maxLength={1000}
            defaultValue={group?.description ?? ""}
            className={`${inputClasses} min-h-16 py-2`}
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={fieldId("emoji")}
          label="Emoji"
          error={state.errors.emoji}
          hint="Shown when there's no photo."
        >
          {(props) => (
            <input
              {...props}
              name="emoji"
              type="text"
              maxLength={8}
              defaultValue={group?.emoji ?? ""}
              className={inputClasses}
            />
          )}
        </Field>

        <Field
          id={fieldId("sortOrder")}
          label="Order"
          error={state.errors.sortOrder}
          hint="Lower numbers come first."
        >
          {(props) => (
            <input
              {...props}
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={group?.sortOrder ?? 0}
              className={inputClasses}
            />
          )}
        </Field>
      </div>

      <Field
        id={fieldId("meetingInfo")}
        label="When and where"
        error={state.errors.meetingInfo}
        hint="Plain text, e.g. Tuesdays 8:00 PM · Stake center gym"
      >
        {(props) => (
          <input
            {...props}
            name="meetingInfo"
            type="text"
            maxLength={200}
            defaultValue={group?.meetingInfo ?? ""}
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("groupmeUrl")}
        label="GroupMe link"
        error={state.errors.groupmeUrl}
        hint="Leave blank and the Join button is hidden."
      >
        {(props) => (
          <input
            {...props}
            name="groupmeUrl"
            type="url"
            defaultValue={group?.groupmeUrl ?? ""}
            placeholder="https://groupme.com/join_group/..."
            className={inputClasses}
          />
        )}
      </Field>

      <Field
        id={fieldId("photo")}
        label="Photo"
        error={state.errors.photoUrl}
        hint="JPEG, PNG, WebP or GIF, up to 2 MB. Replaces the emoji."
      >
        {(props) => (
          <input
            {...props}
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="text-sm"
          />
        )}
      </Field>
      <input type="hidden" name="photoUrl" value={group?.photoUrl ?? ""} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <SaveButton label={group ? "Save changes" : "Add group"} />
      </div>
    </form>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}
