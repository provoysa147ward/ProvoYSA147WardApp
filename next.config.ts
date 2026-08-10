import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables `unauthorized()` and `forbidden()` from next/navigation, which
    // the admin layout uses as its 401/403 boundaries. Still flagged in 16.3.
    authInterrupts: true,
  },
};

export default nextConfig;
