"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteGroup,
  saveGroup,
} from "@/app/admin/(protected)/groups/actions";
import {
  INITIAL_ADMIN_ACTION_STATE,
  type AdminActionState,
} from "@/app/admin/(protected)/action-state";
import { Field, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Group } from "@/lib/queries";

export function GroupManager({ groups }: { groups: Group[] }) {
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Groups</h2>
        <Button variant="secondary" onClick={() => setCreating((was) => !was)}>
          {creating ? "Cancel" : "New group"}
        </Button>
      </div>

      {creating ? <GroupForm /> : null}

      {groups.length === 0 ? (
        <EmptyState emoji="👋" title="No groups yet.">
          Add the first one above.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.id}>
              <details className="rounded-2xl border border-line bg-surface">
                <summary className="cursor-pointer list-none p-4">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{group.emoji || "✨"}</span>
                    <span className="font-semibold">{group.name}</span>
                  </span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {group.meetingInfo || "No meeting time set"}
                  </span>
                </summary>
                <div className="border-t border-line p-4">
                  <GroupForm group={group} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupForm({ group }: { group?: Group }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    saveGroup,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const [deleteState, deleteAction] = useActionState<AdminActionState, FormData>(
    deleteGroup,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;

  const formError = state.formError ?? deleteState.formError;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
    <form action={action} className="flex flex-col gap-4">
      {group ? <input type="hidden" name="id" value={group.id} /> : null}

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
        >
          {formError}
        </p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p
          role="status"
          className="rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
        >
          {state.message}
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
              defaultValue={0}
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

      <SaveButton label={group ? "Save changes" : "Add group"} />
    </form>

      {group ? (
        <ConfirmDialog
          trigger="Delete"
          title={`Delete "${group.name}"?`}
          confirmLabel="Delete it"
          body="This removes the group from the site. It can't be undone."
          action={deleteAction}
        >
          <input type="hidden" name="id" value={group.id} />
        </ConfirmDialog>
      ) : null}
    </div>
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
