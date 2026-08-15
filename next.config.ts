import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables `unauthorized()` and `forbidden()` from next/navigation, which
    // the admin layout uses as its 401/403 boundaries. Still flagged in 16.3.
    authInterrupts: true,
  },

  // `/submit` was the public suggest-an-event form, which the ward retired in
  // favour of the GroupMe. Bookmarks and search results still point at it, so
  // it lands on the homepage rather than a 404.
  async redirects() {
    return [{ source: "/submit", destination: "/", permanent: true }];
  },
};

export default nextConfig;
