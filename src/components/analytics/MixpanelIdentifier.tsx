"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { identifyUser } from "@/lib/analytics/mixpanel.services";

export function MixpanelIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      identifyUser(session.user.id, {
        $email: session.user.email,
        $name: session.user.name,
        role: session.user.role,
        organization_id: session.user.organizationId,
      });
    }
  }, [status, session]);

  return null;
}
