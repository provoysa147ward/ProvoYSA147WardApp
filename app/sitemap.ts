import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/calendar`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/groups`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/submit`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
