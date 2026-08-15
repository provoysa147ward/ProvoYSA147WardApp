import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

const VARIANTS = {
  primary: "bg-accent text-cream hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:border-accent",
  quiet: "text-ink-muted hover:text-accent",
} as const;

/**
 * `min-h-11` keeps touch targets at the 44px minimum, which matters more here
 * than usual — most visitors arrive on a phone. `large` is for the rare button
 * that is the point of the page rather than one option among several.
 */
const SIZES = {
  default: "min-h-11 px-5 text-sm",
  large: "min-h-14 px-8 text-base sm:text-lg",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

const BASE =
  "inline-flex items-center justify-center gap-3 rounded-full font-semibold transition disabled:opacity-60";

function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "default",
) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}`;
}

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  // HTML defaults a button inside a form to type="submit". Defaulting to
  // "button" here means adding an onClick handler cannot accidentally submit
  // the form around it; submit buttons pass type="submit" explicitly.
  type = "button",
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type}
      className={`${buttonClasses(variant, size)} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "default",
  className = "",
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${buttonClasses(variant, size)} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
