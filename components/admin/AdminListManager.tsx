"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";

import {
  addAdminEmail,
  removeAdminEmail,
} from "@/app/admin/(protected)/admins/actions";
import {
  INITIAL_ADMIN_ACTION_STATE,
  type AdminActionState,
} from "@/lib/adminActionState";
import { Field, inputClasses } from "@/components/forms/Field";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface AdminEmailRow {
  email: string;
  isPermanent: boolean;
}

export function AdminListManager({
  admins,
  currentEmail,
}: {
  admins: AdminEmailRow[];
  currentEmail: string;
}) {
  const [addState, addAction] = useActionState<AdminActionState, FormData>(
    addAdminEmail,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const [removeState, removeAction] = useActionState<AdminActionState, FormData>(
    removeAdminEmail,
    INITIAL_ADMIN_ACTION_STATE,
  );
  const prefix = useId();

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">Add an admin</h2>

        <form action={addAction} className="flex flex-col gap-4">
          {addState.formError ? (
            <p
              role="alert"
              className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
            >
              {addState.formError}
            </p>
          ) : null}

          {addState.status === "success" && addState.message ? (
            <p
              role="status"
              className="rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
            >
              {addState.message}
            </p>
          ) : null}

          <Field
            id={`${prefix}-email`}
            label="Email address"
            error={addState.errors.email}
            required
            hint="They sign in at /admin with this exact address — no password, no invitation to accept."
          >
            {(props) => (
              <input
                {...props}
                name="email"
                type="email"
                autoComplete="off"
                placeholder="them@example.com"
                className={inputClasses}
              />
            )}
          </Field>

          <AddButton />
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-tight">
          Who can sign in ({admins.length})
        </h2>

        {removeState.formError ? (
          <p
            role="alert"
            className="rounded-xl border border-accent bg-accent-soft px-4 py-2 text-sm font-semibold text-accent"
          >
            {removeState.formError}
          </p>
        ) : null}

        {removeState.status === "success" && removeState.message ? (
          <p
            role="status"
            className="rounded-xl border border-cat-sports-border bg-cat-sports-bg px-4 py-2 text-sm font-semibold text-cat-sports-fg"
          >
            {removeState.message}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2">
          {admins.map((admin) => (
            <li
              key={admin.email}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3"
            >
              <div>
                <p className="font-semibold">
                  {admin.email}
                  {admin.email === currentEmail ? (
                    <span className="ml-2 text-sm font-normal text-ink-muted">
                      (you)
                    </span>
                  ) : null}
                </p>
                {admin.isPermanent ? (
                  <p className="text-xs text-ink-muted">
                    The ward&apos;s permanent address. It can&apos;t be removed
                    — that&apos;s what stops anyone locking everyone out.
                  </p>
                ) : null}
              </div>

              {/* No remove control at all for the permanent row. The database
                  refuses the delete too; this just avoids offering it. */}
              {admin.isPermanent ? null : (
                <ConfirmDialog
                  trigger="Remove"
                  title={`Remove ${admin.email}?`}
                  confirmLabel="Remove them"
                  body={
                    admin.email === currentEmail ? (
                      <>
                        This is <strong>your own</strong> address. You&apos;ll be
                        signed out of the admin area and will need another admin
                        to add you back.
                      </>
                    ) : (
                      <>They&apos;ll no longer be able to sign in at /admin.</>
                    )
                  }
                  action={removeAction}
                >
                  <input type="hidden" name="email" value={admin.email} />
                </ConfirmDialog>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="self-start">
      {pending ? "Adding…" : "Add admin"}
    </Button>
  );
}
