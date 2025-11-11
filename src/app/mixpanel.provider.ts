"use client";

import { useEffect } from "react";
import { initMixpanel } from "@/lib/analytics/mixpanel.services";

export function MixpanelProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL !== "http://localhost:3000") {
      initMixpanel();
    }
  }, []);

  return null;
}
