import type { Metadata } from "next";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/database/prisma";
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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      schoolName: true,
      teamName: true,
      schoolAddress: true,
      role: true,
    },
  });

  const hasSchoolDetails = Boolean(user?.schoolName?.trim()) && Boolean(user?.teamName?.trim()) && Boolean(user?.schoolAddress?.trim());
  const bypassOnboarding = await shouldBypassOnboarding();
  
  // Collaborators (non-AD roles) or those with the bypass cookie should not be forced into onboarding
  const isCollaborator = user?.role !== "ATHLETIC_DIRECTOR" && user?.role !== "SUPER_ADMIN";

  if (!hasSchoolDetails && !isCollaborator && !bypassOnboarding) {
    redirect("/onboarding/details");
  }

  // Clean up bypass cookie if it exists
  if (bypassOnboarding) {
    await clearBypassOnboardingCookie();
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
