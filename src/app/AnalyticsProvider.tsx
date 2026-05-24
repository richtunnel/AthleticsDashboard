"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import * as gtag from "@/lib/analytics/gtag";
import { pixelPageView } from "@/lib/analytics/meta-pixel";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  gtag.initializeAnalytics();

  useEffect(() => {
    const url = pathname + searchParams.toString();
    // Google Analytics
    gtag.pageview(url);
    // Meta Pixel — fire ViewContent on every SPA route change
    // (the base pixel code in layout.tsx already fires the initial PageView)
    pixelPageView();
  }, [pathname, searchParams]);

  return null;
}
