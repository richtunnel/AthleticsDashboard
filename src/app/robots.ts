import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/utils/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/onboarding/plans"],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard/",
          "/onboarding/",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-recovery-email",
          "/feedback",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
