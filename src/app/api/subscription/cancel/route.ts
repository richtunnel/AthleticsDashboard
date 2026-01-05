import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const stripe = getStripe();
    
    // Advanced Logic: Ensure no charges are made if cancelled during trial
    const isTrialing = user.subscription.status === "TRIALING" || 
                      (user.subscription.trialEnd && new Date() < user.subscription.trialEnd);

    if (isTrialing) {
      // If trialing, cancel immediately to guarantee no charge is attempted
      await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId);
    } else {
      // If not trialing, cancel at the end of the billing period
      await stripe.subscriptions.update(
        user.subscription.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );
    }

    // Calculate grace period (30 days after current period end)
    const gracePeriodEndsAt = user.subscription.currentPeriodEnd
      ? new Date(user.subscription.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;

    // Update our database
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
          cancelAtPeriodEnd: !isTrialing,
          canceledAt: new Date(),
          status: "CANCELED",
          gracePeriodEndsAt,
          deletionScheduledAt: gracePeriodEndsAt,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          hasReceivedFreeTrial: true,
          cancellationDate: new Date(),
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: isTrialing 
        ? "Trial subscription cancelled successfully. No charges will be made." 
        : "Subscription cancelled successfully",
      gracePeriodEndsAt,
    });
  } catch (err: any) {
    console.error("Error cancelling subscription:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error cancelling subscription" },
      { status: 500 }
    );
  }
}
