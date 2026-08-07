"use client";

import type { ReactNode } from "react";

/**
 * A labelled form control with its error and helper text wired up.
 *
 * The error is `role="alert"` and referenced by `aria-describedby`, and the
 * control gets `aria-invalid`, so a screen reader announces the problem rather
 * than leaving the field silently red.
 */
export function Field({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
    required: boolean | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-accent">
            {" "}
            *
          </span>
        ) : (
          <span className="font-normal text-ink-muted"> (optional)</span>
        )}
      </label>

      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}

      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-semibold text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const inputClasses =
  "min-h-11 rounded-xl border border-line bg-surface px-3 text-base text-ink aria-invalid:border-accent";
