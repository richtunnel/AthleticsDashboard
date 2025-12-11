import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { createSignupLog } from "@/lib/services/signup-log.service";
import { withCSRFProtection } from "@/lib/security/csrf";

export const DELETE = withCSRFProtection(async (req: NextRequest) => {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Cancel Stripe subscription if exists
    if (user.stripeCustomerId && user.subscription?.stripeSubscriptionId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Error canceling Stripe subscription:", stripeError);
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // Create signup log entry to prevent re-signup within 90 days
    try {
      await createSignupLog({
        email: user.email,
        phone: user.phone,
        deletedUserId: userId,
        reason: 'account_deleted',
      });
      console.log('[DeleteAccount] Signup log created for user:', userId);
    } catch (signupLogError) {
      console.error('[DeleteAccount] Failed to create signup log:', signupLogError);
      // Continue with deletion even if signup log fails
    }

    // Delete user - Prisma will cascade delete related records:
    // - Accounts
    // - Sessions
    // - Games (created by user)
    // - Email logs
    // - Email groups/campaigns
    // - Table preferences
    // - Login events
    // - Recovery email
    // - Account deletion reminders
    // - Subscription
    // - Referrals
    // - Reward points
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json(
      { success: true, message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account" },
      { status: 500 }
    );
  }
});
