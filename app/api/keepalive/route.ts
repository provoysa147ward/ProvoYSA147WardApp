import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

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

  const { error } = await createAdminClient()
    .from("site_settings")
    .select("id")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
