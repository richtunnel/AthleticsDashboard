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
      return NextResponse.json({ error: "No subscription found" }, { status: 404 });
    }

    // Check if we're within grace period
    const now = new Date();
    if (user.subscription.gracePeriodEndsAt && user.subscription.gracePeriodEndsAt < now) {
      return NextResponse.json(
        { error: "Grace period has expired. Please create a new subscription." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    
    // Resume the subscription by removing cancel_at_period_end
    const stripeSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    // Update our database
    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
        status: "ACTIVE",
        gracePeriodEndsAt: null,
        deletionScheduledAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription resumed successfully",
    });
  } catch (err: any) {
    console.error("Error resuming subscription:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unexpected error resuming subscription" },
      { status: 500 }
    );
  }
}
