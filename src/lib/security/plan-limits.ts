import { prisma } from "@/lib/database/prisma";
import { isMemberAccessToken } from "@/lib/utils/memberAccess";
import { getStripeConfig } from "@/lib/stripe-config";

export enum PlanFeature {
  FIND_DATES = "FIND_DATES",
  SCORE_TRACKER = "SCORE_TRACKER",
  TRAVEL_RECOMMENDATIONS = "TRAVEL_RECOMMENDATIONS",
  BUDGET_CALCULATOR = "BUDGET_CALCULATOR",
}

export const PLAN_LIMITS = {
  STANDARD: {
    monthlyEmailLimit: 200,
    maxWorksheets: 5,
  },
  TEAM: {
    monthlyEmailLimit: 150000,
    maxWorksheets: 10,
  },
  PLUS: {
    monthlyEmailLimit: 250000,
    maxWorksheets: 1000, // Unlimited
  },
} as const;

export async function getUserPlanInfo(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      plan: true,
      priceId: true,
      createdAt: true,
      trialEnd: true,
      organizationId: true,
      subscription: {
        select: {
          priceId: true,
          status: true,
          trialEnd: true,
        },
      },
    },
  });

  if (!user) return null;

  // Check if it's opletics25 member access (though here we have userId, not the token)
  // Actually, member access users have a specific email or organizationId
  const isOpletics25 = user.email === "members+opletics25@opletics.com" || user.organizationId === "members-org-opletics25";

  const config = getStripeConfig();
  const standardPriceIds = [config.standardPriceIdMo, config.standardPriceIdYr].filter(Boolean);
  const teamPriceIds = [config.teamPriceIdMo, config.teamPriceIdYr].filter(Boolean);
  const plusPriceIds = [config.plusPriceIdMo, config.plusPriceIdYr].filter(Boolean);

  const currentPriceId = user.subscription?.priceId || user.priceId || user.plan;

  let planType: "STANDARD" | "TEAM" | "PLUS" | "FREE_TRIAL" = "FREE_TRIAL";

  if (isOpletics25) {
    planType = "PLUS"; // Give full access
  } else if (currentPriceId && (plusPriceIds.includes(currentPriceId) || currentPriceId.toLowerCase().includes("plus"))) {
    planType = "PLUS";
  } else if (currentPriceId && (teamPriceIds.includes(currentPriceId) || currentPriceId.toLowerCase().includes("team"))) {
    planType = "TEAM";
  } else if (currentPriceId && (standardPriceIds.includes(currentPriceId) || currentPriceId.toLowerCase().includes("standard") || currentPriceId === "free_trial_plan")) {
    planType = "STANDARD";
  }

  // Determine if still in trial (first 2 weeks)
  const trialEnd = user.subscription?.trialEnd || user.trialEnd || new Date(user.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const isTrialActive = new Date() < trialEnd;

  return {
    planType,
    isTrialActive,
    isOpletics25,
  };
}

export async function hasFeatureAccess(userId: string, feature: PlanFeature): Promise<boolean> {
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return false;

  if (planInfo.isOpletics25) return true;
  if (planInfo.isTrialActive) return true;

  // After trial, Standard plan has restricted features
  if (planInfo.planType === "STANDARD") {
    return false; // Standard plan doesn't have these features after 2 weeks
  }

  // TEAM and PLUS have full access for now as per instructions
  return true;
}

const RESTRICTED_GAME_FIELDS = ["cost", "travelCost", "recommendedDepartureTime", "recommendedArrivalTime", "actualDepartureTime", "actualArrivalTime", "travelTimeMinutes", "autoFillBusInfo"];

export async function filterRestrictedGameFields(userId: string, data: any) {
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo || planInfo.isOpletics25 || planInfo.isTrialActive) {
    return data;
  }

  if (planInfo.planType === "STANDARD") {
    const filteredData = { ...data };
    RESTRICTED_GAME_FIELDS.forEach((field) => {
      delete filteredData[field];
    });
    return filteredData;
  }

  return data;
}

export async function getEmailLimit(userId: string): Promise<number> {
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return 200; // Default to lowest

  if (planInfo.isOpletics25) return 1000000; // Effectively unlimited
  if (planInfo.isTrialActive) return 1000000; // Full access during trial

  if (planInfo.planType === "PLUS") return PLAN_LIMITS.PLUS.monthlyEmailLimit;
  if (planInfo.planType === "TEAM") return PLAN_LIMITS.TEAM.monthlyEmailLimit;
  return PLAN_LIMITS.STANDARD.monthlyEmailLimit;
}

export async function getWorksheetLimit(userId: string): Promise<number> {
  const planInfo = await getUserPlanInfo(userId);
  if (!planInfo) return PLAN_LIMITS.STANDARD.maxWorksheets;

  if (planInfo.isOpletics25) return 1000; // Unlimited
  if (planInfo.isTrialActive) return 1000; // Full access during trial

  if (planInfo.planType === "PLUS") return PLAN_LIMITS.PLUS.maxWorksheets;
  if (planInfo.planType === "TEAM") return PLAN_LIMITS.TEAM.maxWorksheets;
  return PLAN_LIMITS.STANDARD.maxWorksheets;
}
