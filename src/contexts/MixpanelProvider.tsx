"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initMixpanel, trackMixpanelPageView } from "@/lib/mixpanel";

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    initMixpanel();
  }, []);

  const searchParamsString = searchParams?.toString() ?? "";

  useEffect(() => {
    if (!pathname) {
      return;
    }

    const pathWithSearch = searchParamsString ? `${pathname}?${searchParamsString}` : pathname;

    if (lastTrackedPath.current === pathWithSearch) {
      return;
    }

    trackMixpanelPageView(pathWithSearch);
    lastTrackedPath.current = pathWithSearch;
  }, [pathname, searchParamsString]);

  return <>{children}</>;
}
