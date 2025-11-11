"use client";

import { useEffect } from "react";
import { initMixpanel, identifyUser } from "@/lib/analytics/mixpanel.services";
import { useSession } from "next-auth/react";

export function MixpanelProvider() {
  const { data: session, status } = useSession();

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      identifyUser(session.user.id, {
        $email: session.user.email,
        $name: session.user.name,
        role: (session.user as any).role,
      });
    }
  }, [session, status]);

  return null;
}
