import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(key, { apiVersion: "2025-09-30.clover" });
  }
  return stripeClient;
}

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
    
    // Cancel the subscription at period end
    const stripeSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Calculate grace period (30 days after current period end)
    const gracePeriodEndsAt = user.subscription.currentPeriodEnd
      ? new Date(user.subscription.currentPeriodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;

    // Update our database
    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        status: "CANCELED",
        gracePeriodEndsAt,
        deletionScheduledAt: gracePeriodEndsAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
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
