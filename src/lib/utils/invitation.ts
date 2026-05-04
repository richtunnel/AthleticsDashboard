import { cookies } from "next/headers";
import { prisma } from "@/lib/database/prisma";
import { verifyInvitationToken } from "@/lib/utils/collaborationTokens";
import { CollaborativeRole, UserRole } from "@prisma/client";

export const INVITATION_COOKIE_NAME = "pending_invitation_token";
export const BYPASS_ONBOARDING_COOKIE_NAME = "bypass_onboarding";
export const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

export const roleMapping: Record<CollaborativeRole, UserRole> = {
  VIEWER: UserRole.VENDOR_READ_ONLY,
  MEMBER: UserRole.ASSISTANT_AD,
};

export async function checkInvitationCookie() {
  try {
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get(INVITATION_COOKIE_NAME)?.value;
    if (!pendingToken) return null;

    const decodedToken = verifyInvitationToken(pendingToken);
    if (!decodedToken) return null;

    // Check if token has expired
    const now = new Date();
    if (new Date(decodedToken.expiresAt) < now) return null;

    const mappedRole = roleMapping[decodedToken.role as CollaborativeRole] ?? UserRole.VENDOR_READ_ONLY;

    // Fetch the owner's organization and school details
    const owner = await prisma.user.findUnique({
      where: { id: decodedToken.ownerId },
      select: {
        organizationId: true,
        schoolName: true,
        teamName: true,
        schoolAddress: true,
        city: true,
        aiSchedulerEnabled: true,
        aiTravelTimesEnabled: true,
        aiEmailGenerationEnabled: true,
        costBudgetEnabled: true,
        scoreTrackerEnabled: true,
      },
    });

    if (!owner?.organizationId) return null;

    return {
      token: pendingToken,
      ownerId: decodedToken.ownerId,
      email: decodedToken.email,
      organizationId: owner.organizationId,
      role: mappedRole,
      schoolName: owner.schoolName,
      teamName: owner.teamName,
      schoolAddress: owner.schoolAddress,
      city: owner.city,
      aiSchedulerEnabled: owner.aiSchedulerEnabled,
      aiTravelTimesEnabled: owner.aiTravelTimesEnabled,
      aiEmailGenerationEnabled: owner.aiEmailGenerationEnabled,
      costBudgetEnabled: owner.costBudgetEnabled,
      scoreTrackerEnabled: owner.scoreTrackerEnabled,
    };
  } catch (error) {
    console.error("[Invitation] Error checking invitation cookie:", error);
    return null;
  }
}

export async function setBypassOnboardingCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(BYPASS_ONBOARDING_COOKIE_NAME, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes is plenty
      path: "/",
    });
  } catch (error) {
    console.error("[Invitation] Error setting bypass onboarding cookie:", error);
  }
}

export async function shouldBypassOnboarding() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(BYPASS_ONBOARDING_COOKIE_NAME)?.value === "true";
  } catch (error) {
    return false;
  }
}

export async function clearBypassOnboardingCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(BYPASS_ONBOARDING_COOKIE_NAME);
  } catch (error) {
    console.error("[Invitation] Error clearing bypass onboarding cookie:", error);
  }
}

export async function clearInvitationCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(INVITATION_COOKIE_NAME);
  } catch (error) {
    console.error("[Invitation] Error clearing invitation cookie:", error);
  }
}
