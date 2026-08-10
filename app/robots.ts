import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

/** The admin area and the auth callback are never worth indexing. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/auth/"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
