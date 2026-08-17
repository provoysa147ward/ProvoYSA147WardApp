import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * Daily keep-alive for the Supabase free tier, which pauses a project after
 * seven idle days. `vercel.json` points a once-a-day cron here (the Hobby
 * limit) and it runs one trivial query.
 *
 * Bearer auth is not optional: without it this would be an unauthenticated
 * endpoint that queries the database on demand. Vercel sends the header
 * automatically once `CRON_SECRET` is set. If the secret is missing entirely
 * the route refuses outright rather than falling open.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The publishable key, not the secret one: groups is world-readable, so this
  // needs no privilege and the secret key keeps its single documented
  // pre-authentication use (the login allowlist check).
  //
  // Zero rows is a pass. The point is that Postgres answered at all — an empty
  // groups table is a perfectly awake database.
  const { error } = await createClient(supabaseUrl(), supabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
    .from("groups")
    .select("id")
    .limit(1);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
