import Link from "next/link";

// Placeholder home page. Phase 3 replaces this with the real one: welcome
// blurb, announcement banner, the next five events, and quick links, all read
// from Supabase.
export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Welcome to the Provo YSA 147th Ward
      </h1>
      <p className="mt-4 max-w-prose text-lg text-ink-muted">
        Find out what&apos;s happening, see which groups you can join, and tell
        us about something you&apos;d like the ward to know.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/calendar"
          className="inline-flex min-h-11 items-center rounded-full bg-accent px-5 font-semibold text-cream"
        >
          See the calendar
        </Link>
        <Link
          href="/submit"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-semibold text-ink"
        >
          Suggest an event
        </Link>
      </div>
    </div>
  );
}
