import { prisma } from "@/lib/database/prisma";
import type { PlanType, SubscriptionStatus, UserRole } from "@prisma/client";

export interface UserWithSubscription {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  stripeCustomerId: string | null;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    planType: PlanType | null;
    billingCycle: string | null;
    priceId: string | null;
    planProductId: string | null;
    planLookupKey: string | null;
    planNickname: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    deletionScheduledAt: Date | null;
    gracePeriodEndsAt: Date | null;
    stripeSubscriptionId: string | null;
  } | null;
  recoveryEmail: {
    id: string;
    email: string;
    verified: boolean;
  } | null;
  lastLogin: {
    timestamp: Date;
    city: string | null;
    country: string | null;
  } | null;
  todayLoginCount: number;
}

export async function getUserWithSubscription(userId: string): Promise<UserWithSubscription | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      stripeCustomerId: true,
      subscription: {
        select: {
          id: true,
          status: true,
          planType: true,
          billingCycle: true,
          priceId: true,
          planProductId: true,
          planLookupKey: true,
          planNickname: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          canceledAt: true,
          deletionScheduledAt: true,
          gracePeriodEndsAt: true,
          stripeSubscriptionId: true,
        },
      },
      recoveryEmail: {
        select: {
          id: true,
          email: true,
          verified: true,
        },
      },
      loginEvents: {
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
        select: {
          timestamp: true,
          city: true,
          country: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Count today's logins
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayLoginCount = await prisma.userLoginEvent.count({
    where: {
      userId: userId,
      timestamp: {
        gte: startOfDay,
      },
    },
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    stripeCustomerId: user.stripeCustomerId,
    subscription: user.subscription,
    recoveryEmail: user.recoveryEmail,
    lastLogin: user.loginEvents[0] || null,
    todayLoginCount,
  };
}

export async function getRecentLoginEvents(userId: string, limit: number = 10) {
  return await prisma.userLoginEvent.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: {
      id: true,
      timestamp: true,
      ipAddress: true,
      city: true,
      country: true,
      success: true,
    },
  });
}
