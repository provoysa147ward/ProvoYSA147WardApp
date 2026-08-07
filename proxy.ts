import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookie on every request, and sends obviously
 * signed-out visitors to the login page before a page renders.
 *
 * This is a convenience layer and nothing more. CVE-2025-29927 showed that a
 * proxy check can be skipped with a crafted header, so the real gates are
 * `app/admin/layout.tsx`, `requireAdmin()` inside every admin action, and RLS.
 * Any change here must be mirrored in all three — see docs/HANDOFF.md.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims() refreshes an expiring session as a side effect. Do not remove
  // it or add anything between it and the response: the refreshed cookies have
  // to reach the browser.
  const { data } = await supabase.auth.getClaims();

  const { pathname } = request.nextUrl;
  const isAdminArea =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");

  if (isAdminArea && !data?.claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — the session needs
     * refreshing on ordinary page requests, not on a favicon fetch.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
