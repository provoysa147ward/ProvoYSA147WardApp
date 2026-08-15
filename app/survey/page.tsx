import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { GROUPME_JOIN_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "New Member Survey",
  description:
    "The Provo YSA 147th Ward new member survey — coming soon.",
};

/**
 * A placeholder until the real survey exists.
 *
 * Deliberately left out of `app/sitemap.ts`: there is nothing here worth
 * indexing yet, and the entry goes in when the real survey lands.
 */
export default function SurveyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">New Member Survey</h1>

      <p className="max-w-prose text-lg text-ink-muted">
        The survey is on its way — it&apos;s not quite ready yet. In the
        meantime, the fastest way to meet people is to hop into the ward GroupMe
        and say hi.
      </p>

      <div>
        <ButtonLink
          href={GROUPME_JOIN_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          Join the Ward GroupMe
          <span className="sr-only"> (opens in a new tab)</span>
        </ButtonLink>
      </div>
    </div>
  );
}
