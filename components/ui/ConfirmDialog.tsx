"use client";

import { useId, type ReactNode } from "react";

import { Button } from "./Button";
import { useDialog } from "./useDialog";

/**
 * A destructive action behind a native `<dialog>` confirmation.
 *
 * The children render inside the confirm form, so the caller can pass the
 * hidden inputs the action needs — the real submit happens from in here.
 */
export function ConfirmDialog({
  trigger,
  title,
  body,
  confirmLabel,
  action,
  children,
}: {
  trigger: string;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  action: (formData: FormData) => void;
  children?: ReactNode;
}) {
  const dialog = useDialog();
  // A page can hold many of these (one per row), so the heading id has to be
  // unique or every dialog's aria-labelledby resolves to the first one's title.
  const headingId = useId();

  return (
    <>
      <Button type="button" variant="secondary" onClick={dialog.show}>
        {trigger}
      </Button>

      <dialog
        {...dialog.dialogProps}
        aria-labelledby={headingId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-4 p-5">
          <h2 id={headingId} className="text-lg font-bold">
            {title}
          </h2>
          <div className="text-sm text-ink-muted">{body}</div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={dialog.hide}
              autoFocus
            >
              Cancel
            </Button>
            <form action={action}>
              {children}
              <Button type="submit">{confirmLabel}</Button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
