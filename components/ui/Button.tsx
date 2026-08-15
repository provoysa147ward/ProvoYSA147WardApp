import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-accent text-cream hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:border-accent",
  quiet: "text-ink-muted hover:text-accent",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

/**
 * `min-h-11` keeps touch targets at the 44px minimum, which matters more here
 * than usual — most visitors arrive on a phone.
 */
const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:opacity-60";

function buttonClasses(variant: ButtonVariant = "primary") {
  return `${BASE} ${VARIANTS[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  // HTML defaults a button inside a form to type="submit". Defaulting to
  // "button" here means adding an onClick handler cannot accidentally submit
  // the form around it; submit buttons pass type="submit" explicitly.
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${buttonClasses(variant)} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
