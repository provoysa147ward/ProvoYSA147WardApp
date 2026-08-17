"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteQuickLink,
  saveQuickLink,
} from "@/app/admin/(protected)/actions";
import {
  INITIAL_ADMIN_ACTION_STATE,
  type AdminActionState,
} from "@/lib/adminActionState";
import { Field, inputClasses } from "@/components/forms/Field";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { QuickLink } from "@/lib/queries";

/**
 * The row of links under the home page's events, managed on the admin
 * dashboard. This is what is left of the old `/admin/content` screen — the
 * site-settings half of it is now constants in `lib/site.ts`.
 */
export function QuickLinksManager({ links }: { links: QuickLink[] }) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight">Quick links</h2>
        <Button variant="secondary" onClick={() => setAdding((was) => !was)}>
          {adding ? "Cancel" : "New link"}
        </Button>
      </div>

      {adding ? <QuickLinkForm /> : null}

      {links.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No links yet. The quick-links row is hidden until there is at least
          one.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => (
            <li key={link.id}>
              <QuickLinkForm link={link} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickLinkForm({ link }: { link?: QuickLink }) {
  const [state, action] = useActionState<AdminActionState, FormData>(
    saveQuickLink,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const [deleteState, deleteAction] = useActionState<AdminActionState, FormData>(
    deleteQuickLink,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();
  const fieldId = (name: string) => `${prefix}-${name}`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <form action={action} className="flex flex-col gap-4">
        {link ? <input type="hidden" name="id" value={link.id} /> : null}
        <Banner state={state} />
        {deleteState.formError ? <Banner state={deleteState} /> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id={fieldId("label")}
            label="Label"
            error={state.errors.label}
            required
          >
            {(props) => (
              <input
                {...props}
                name="label"
                type="text"
                maxLength={60}
                defaultValue={link?.label ?? ""}
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("url")}
            label="Link"
            error={state.errors.url}
            required
            hint="Must start with https://"
          >
            {(props) => (
              <input
                {...props}
                name="url"
                type="url"
                defaultValue={link?.url ?? ""}
                placeholder="https://"
                className={inputClasses}
              />
            )}
          </Field>

          <Field
            id={fieldId("sortOrder")}
            label="Order"
            error={state.errors.sortOrder}
          >
            {(props) => (
              <input
                {...props}
                name="sortOrder"
                type="number"
                min={0}
                max={9999}
                defaultValue={link?.sortOrder ?? 0}
                className={inputClasses}
              />
            )}
          </Field>
        </div>

        <SaveButton label={link ? "Save link" : "Add link"} />
      </form>

      {link ? (
        <ConfirmDialog
          trigger="Delete"
          title={`Delete "${link.label}"?`}
          confirmLabel="Delete it"
          body="This removes the link from the home page."
          action={deleteAction}
        >
          <input type="hidden" name="id" value={link.id} />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Saving…" : label}
    </Button>
  );
}
