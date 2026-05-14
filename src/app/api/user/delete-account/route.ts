import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { createSignupLog } from "@/lib/services/signup-log.service";
import { revokeGoogleToken } from "@/lib/google/revoke";

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        accounts: {
          where: { provider: "google" },
          select: {
            refresh_token: true,
            access_token: true,
          },
        },
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

    const googleTokensToRevoke = new Set<string>();
    if (user.googleCalendarRefreshToken) {
      googleTokensToRevoke.add(user.googleCalendarRefreshToken);
    }

    if (user.googleCalendarAccessToken) {
      googleTokensToRevoke.add(user.googleCalendarAccessToken);
    }

    for (const account of user.accounts) {
      if (account.refresh_token) {
        googleTokensToRevoke.add(account.refresh_token);
      }

      if (account.access_token) {
        googleTokensToRevoke.add(account.access_token);
      }
    }

    if (googleTokensToRevoke.size > 0) {
      await Promise.all(Array.from(googleTokensToRevoke).map((token) => revokeGoogleToken(token)));
    }

    // ConnectedParent.parentUserId is a plain String — no User FK, no cascade.
    // Explicitly delete it before removing the User so no stale orphan row remains.
    await prisma.connectedParent.deleteMany({ where: { parentUserId: userId } });

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
    // - Conversations (via ParentConversations relation)
    // - CalendarSyncRequests
    // - ParentAthleteLinks
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
