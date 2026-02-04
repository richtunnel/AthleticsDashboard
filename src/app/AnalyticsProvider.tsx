"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import * as gtag from "@/lib/analytics/gtag";

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!window.gtag) return;

    const url = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    gtag.pageview(url);
  }, [pathname, searchParams]);

  return null;
}
