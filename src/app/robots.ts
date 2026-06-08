import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/utils/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/how-it-works",
          "/about",
          "/parents",
          "/careers",
          "/docs",
          "/onboarding/start",
          "/onboarding/plans",
          "/onboarding/signup",
          "/onboarding/parent",
          "/onboarding/parent/plans",
          "/onboarding/parent-signup",
          "/assets/",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard/",
          "/onboarding/",
          "/verify-recovery-email",
          "/_next/",
        ],
      },
    ],
    sitemap: "https://opletics.com/sitemap.xml",
    host: baseUrl,
  };
}
