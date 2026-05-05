import type { Metadata } from "next";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/utils/authOptions";
import { shouldBypassOnboarding, clearBypassOnboardingCookie } from "@/lib/utils/invitation";
import { isMemberAccessToken } from "@/lib/utils/memberAccess";
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

  // Check if user is a member access user - they bypass onboarding entirely
  const isMemberAccess = isMemberAccessToken(session.user as any);
  
  // Use session user fields instead of database queries
  // School details are now centralized in the JWT/Session
  const hasSchoolDetails = Boolean(
    session.user.schoolName?.trim() && 
    session.user.teamName?.trim() && 
    session.user.schoolAddress?.trim()
  );
  
  const bypassOnboarding = await shouldBypassOnboarding();
  
  // Collaborators (non-AD roles) should not be forced into onboarding
  // Super admins also don't need onboarding
  const isCollaborator = session.user.role !== "ATHLETIC_DIRECTOR" && session.user.role !== "SUPER_ADMIN";

  // Redirect to onboarding if:
  // - User is not a member access user (members bypass onboarding)
  // - User doesn't have school details
  // - User is not a collaborator (they inherit details from inviter)
  // - No bypass cookie is set
  if (!isMemberAccess && !hasSchoolDetails && !isCollaborator && !bypassOnboarding) {
    redirect("/onboarding/details");
  }

  // Clean up bypass cookie if it exists
  if (bypassOnboarding) {
    await clearBypassOnboardingCookie();
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
