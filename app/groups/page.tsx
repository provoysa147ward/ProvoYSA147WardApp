import type { Metadata } from "next";
import Image from "next/image";

import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGroups, type Group } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Groups",
  description: "Groups you can join in the Provo YSA 147th Ward.",
};

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Jump into whichever ones sound good. Most of them coordinate on
          GroupMe.
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState emoji="👋" title="No groups listed yet.">
          Check back soon — this is where they&apos;ll show up.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <GroupCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        {group.photoUrl ? (
          <Image
            src={group.photoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl"
          >
            {group.emoji || "✨"}
          </span>
        )}
        <h2 className="text-lg font-bold">{group.name}</h2>
      </div>

      <p className="text-sm text-ink-muted">{group.description}</p>

      {group.meetingInfo ? (
        <p className="text-sm font-semibold text-ink">{group.meetingInfo}</p>
      ) : null}

      {group.groupmeUrl ? (
        <div className="mt-auto pt-1">
          <ButtonLink
            href={group.groupmeUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Join on GroupMe
            <span className="sr-only"> ({group.name}, opens in a new tab)</span>
          </ButtonLink>
        </div>
      ) : null}
    </article>
  );
}
