"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

export async function getSubscriptionStatus() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized", status: null };
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        status: true,
        planType: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        cancelAt: true,
        trialEnd: true,
        createdAt: true,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        hasReceivedFreeTrial: true,
        trialEnd: true,
      },
    });

    return {
      subscription,
      user,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching subscription status:", error);
    return { error: "Failed to fetch subscription status", status: null };
  }
}
