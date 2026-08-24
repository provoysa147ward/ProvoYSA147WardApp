import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";
import { SURVEY_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "New Member Survey",
  description:
    "The Provo YSA 147th Ward new member survey — tell us who you are.",
};

/**
 * A signpost to the ward's Google Form.
 *
 * The home page links straight to the form, so this page exists only for
 * anyone arriving on the `/survey` URL from before the form existed.
 *
 * Deliberately left out of `app/sitemap.ts`: the form itself is the thing, and
 * indexing a page whose only content is a link to it would put a redundant
 * result in front of the real one.
 */
export default function SurveyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">New Member Survey</h1>

      <p className="max-w-prose text-lg text-ink-muted">
        New to the ward? Fill this out so we know who you are — it only takes a
        minute.
      </p>

      <div>
        <ButtonLink
          href={SURVEY_URL}
          target="_blank"
          rel="noreferrer noopener"
        >
          Open the survey
          <span className="sr-only"> (opens in a new tab)</span>
        </ButtonLink>
      </div>
    </div>
  );
}
