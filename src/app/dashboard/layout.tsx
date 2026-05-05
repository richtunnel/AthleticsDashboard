import type { Metadata } from "next";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/utils/authOptions";
import { shouldBypassOnboarding, clearBypassOnboardingCookie } from "@/lib/utils/invitation";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const bypassOnboarding = await shouldBypassOnboarding();

  if (!session.user.isOnboarded && !bypassOnboarding) {
    redirect("/onboarding/details");
  }

  if (bypassOnboarding) {
    await clearBypassOnboardingCookie();
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
