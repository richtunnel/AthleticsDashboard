import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/utils/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/onboarding/start",
          "/onboarding/plans",
          "/onboarding/parent/plans",
          "/onboarding/parent-signup",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard/",
          "/onboarding/",
          "/verify-recovery-email",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
