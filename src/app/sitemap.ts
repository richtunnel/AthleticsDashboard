import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/utils/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const now = new Date();

  const routes: Array<{ path: string; changeFrequency?: MetadataRoute.Sitemap[number]["changeFrequency"]; priority?: number }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/about", changeFrequency: "monthly", priority: 0.8 },
    { path: "/onboarding/start", changeFrequency: "monthly", priority: 0.8 },
    { path: "/onboarding/plans", changeFrequency: "monthly", priority: 0.7 },
    { path: "/onboarding/parent/plans", changeFrequency: "monthly", priority: 0.7 },
    { path: "/onboarding/parent-signup", changeFrequency: "monthly", priority: 0.7 },
    { path: "/parents", changeFrequency: "monthly", priority: 0.9 },
    { path: "/login", changeFrequency: "monthly", priority: 0.5 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.5 },
    { path: "/feedback", changeFrequency: "monthly", priority: 0.5 },
    { path: "/careers", changeFrequency: "monthly", priority: 0.7 },
    { path: "/support", changeFrequency: "yearly", priority: 0.4 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/terms", changeFrequency: "yearly", priority: 0.4 },
    { path: "/incident-response", changeFrequency: "yearly", priority: 0.4 },
    { path: "/disclaimer", changeFrequency: "yearly", priority: 0.4 },
  ];

  return routes.map(({ path, changeFrequency, priority }) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
