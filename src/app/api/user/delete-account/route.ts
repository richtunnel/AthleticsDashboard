import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { createSignupLog } from "@/lib/services/signup-log.service";
import { UserRole } from "@/lib/utils/auth";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role === UserRole.MEMBER) {
      return NextResponse.json(
        { error: "Forbidden - Members cannot delete accounts" },
        { status: 403 }
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

    // Create signup log entry ONLY if user has failed payments
    // This prevents re-signup within 90 days for users with PAST_DUE or UNPAID subscriptions
    const hasFailedPayments = 
      user.subscription?.status === 'PAST_DUE' || 
      user.subscription?.status === 'UNPAID';

    if (hasFailedPayments) {
      try {
        await createSignupLog({
          email: user.email,
          phone: user.phone,
          deletedUserId: userId,
          reason: 'account_deleted_with_failed_payments',
        });
        console.log('[DeleteAccount] Signup log created for user with failed payments:', userId);
      } catch (signupLogError) {
        console.error('[DeleteAccount] Failed to create signup log:', signupLogError);
        // Continue with deletion even if signup log fails
      }
    } else {
      console.log('[DeleteAccount] No failed payments, allowing immediate re-signup for user:', userId);
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
}
