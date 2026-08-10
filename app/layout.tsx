import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import Link from "next/link";

import { siteUrl } from "@/lib/site";

import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Events, groups, and what's happening in the Provo YSA 147th Ward.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Provo YSA 147th Ward",
    template: "%s · Provo YSA 147th Ward",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Provo YSA 147th Ward",
    description: DESCRIPTION,
    siteName: "Provo YSA 147th Ward",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/groups", label: "Groups" },
  { href: "/submit", label: "Suggest an Event" },
] as const;

// Typed explicitly rather than with Next's generated `LayoutProps` global, so
// `tsc --noEmit` passes on a clean checkout — those globals only exist after a
// build or dev run has written `.next/types`.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="text-lg font-bold tracking-tight text-ink">
              Provo YSA 147th Ward
            </Link>
            <nav aria-label="Main">
              <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold">
                {NAV_LINKS.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-11 items-center text-ink-muted hover:text-accent"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto max-w-4xl px-4 py-6 text-sm text-ink-muted">
            <p>
              This is an unofficial site maintained by members of the Provo YSA
              147th Ward. It is not an official publication of The Church of
              Jesus Christ of Latter-day Saints.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
