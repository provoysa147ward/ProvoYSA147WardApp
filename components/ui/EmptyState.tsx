import type { ReactNode } from "react";

/**
 * The site launches with an empty database, so an empty region is a normal
 * state rather than an error. Every list renders one of these instead of
 * nothing.
 */
export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      {emoji ? (
        <p aria-hidden="true" className="text-3xl">
          {emoji}
        </p>
      ) : null}
      <p className="mt-2 font-semibold text-ink">{title}</p>
      {children ? (
        <div className="mt-1 text-sm text-ink-muted">{children}</div>
      ) : null}
    </div>
  );
}
