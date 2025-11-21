/**
 * Account Disable Service
 * 
 * Handles disabling and enabling user accounts.
 * Accounts can be disabled manually or automatically due to payment issues.
 */

import { prisma } from "@/lib/database/prisma";

export type DisableReason = "PAYMENT_OVERDUE" | "MANUAL" | "ADMIN_ACTION" | "VIOLATION";

export interface DisableAccountParams {
  userId: string;
  reason: DisableReason;
}

export interface EnableAccountParams {
  userId: string;
}

/**
 * Disable a user account
 */
export async function disableAccount(params: DisableAccountParams): Promise<void> {
  const { userId, reason } = params;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isDisabled: true,
        disabledAt: new Date(),
        disableReason: reason,
      },
    });

    console.log(`[AccountDisable] Account disabled: userId=${userId}, reason=${reason}`);
  } catch (error) {
    console.error("[AccountDisable] Error disabling account:", error);
    throw error;
  }
}

/**
 * Enable a user account (remove disable status)
 */
export async function enableAccount(params: EnableAccountParams): Promise<void> {
  const { userId } = params;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isDisabled: false,
        disabledAt: null,
        disableReason: null,
      },
    });

    console.log(`[AccountDisable] Account enabled: userId=${userId}`);
  } catch (error) {
    console.error("[AccountDisable] Error enabling account:", error);
    throw error;
  }
}

/**
 * Check if a user account is disabled
 */
export async function isAccountDisabled(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isDisabled: true },
    });

    return user?.isDisabled ?? false;
  } catch (error) {
    console.error("[AccountDisable] Error checking account status:", error);
    // On error, assume not disabled to prevent false lockouts
    return false;
  }
}

/**
 * Get account disable details
 */
export async function getAccountDisableDetails(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isDisabled: true,
        disabledAt: true,
        disableReason: true,
      },
    });

    return user;
  } catch (error) {
    console.error("[AccountDisable] Error getting disable details:", error);
    return null;
  }
}

/**
 * Disable accounts with overdue payments (>48 hours)
 * This should be called by a cron job or scheduled task
 */
export async function disableOverdueAccounts(): Promise<{ disabled: number }> {
  try {
    const GRACE_HOURS = 48;
    const graceDate = new Date();
    graceDate.setHours(graceDate.getHours() - GRACE_HOURS);

    // Find users with overdue payments who aren't already disabled
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["PAST_DUE", "UNPAID"] },
        currentPeriodEnd: {
          lt: graceDate,
        },
        user: {
          isDisabled: false,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            isDisabled: true,
          },
        },
      },
    });

    let disabledCount = 0;

    for (const subscription of overdueSubscriptions) {
      try {
        await disableAccount({
          userId: subscription.user.id,
          reason: "PAYMENT_OVERDUE",
        });
        disabledCount++;
      } catch (error) {
        console.error(`[AccountDisable] Failed to disable user ${subscription.user.id}:`, error);
      }
    }

    console.log(`[AccountDisable] Disabled ${disabledCount} overdue accounts`);

    return { disabled: disabledCount };
  } catch (error) {
    console.error("[AccountDisable] Error in disableOverdueAccounts:", error);
    throw error;
  }
}

/**
 * Auto-enable accounts when payment is successful
 * This should be called from the Stripe webhook
 */
export async function autoEnableOnPayment(userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isDisabled: true,
        disableReason: true,
      },
    });

    // Only auto-enable if disabled due to payment issues
    if (user?.isDisabled && user.disableReason === "PAYMENT_OVERDUE") {
      await enableAccount({ userId });
      console.log(`[AccountDisable] Auto-enabled account after payment: userId=${userId}`);
    }
  } catch (error) {
    console.error("[AccountDisable] Error in autoEnableOnPayment:", error);
    // Don't throw - payment success should not fail due to enable error
  }
}
