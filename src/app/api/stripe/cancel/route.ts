import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { cancelSubscriptionSchema } from "@/lib/validations/subscription";
import { calculateDeletionDeadline, getAccountCleanupConfig } from "@/lib/utils/accountCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = cancelSubscriptionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { immediately } = validationResult.data;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
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

    const canceledSubscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: !immediately,
        ...(immediately && { cancel_at: "now" as any }),
      }
    );

    const cancelAt = canceledSubscription.cancel_at
      ? new Date(canceledSubscription.cancel_at * 1000)
      : null;
    const canceledAtFromStripe = canceledSubscription.canceled_at
      ? new Date(canceledSubscription.canceled_at * 1000)
      : null;
    const canceledAt = immediately ? new Date() : canceledAtFromStripe;
    const currentPeriodEnd = canceledSubscription.current_period_end
      ? new Date(canceledSubscription.current_period_end * 1000)
      : null;
    const cancelAtPeriodEnd = canceledSubscription.cancel_at_period_end ?? false;
    const { gracePeriodDays } = getAccountCleanupConfig();
    const graceReference = cancelAt ?? currentPeriodEnd ?? canceledAt;
    const gracePeriodEndsAt = graceReference
      ? calculateDeletionDeadline(graceReference, gracePeriodDays)
      : null;

    const updatedSubscription = await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        status: immediately ? "CANCELED" : user.subscription.status,
        cancelAt,
        cancelAtPeriodEnd,
        canceledAt: canceledAt ?? user.subscription.canceledAt,
        currentPeriodEnd,
        gracePeriodEndsAt,
        deletionScheduledAt: gracePeriodEndsAt ?? user.subscription.deletionScheduledAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: immediately
        ? "Subscription canceled immediately"
        : "Subscription will be canceled at the end of the billing period",
      subscription: {
        status: updatedSubscription.status,
        cancelAt: updatedSubscription.cancelAt,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        gracePeriodEndsAt: updatedSubscription.gracePeriodEndsAt,
      },
    });
  } catch (error: any) {
    console.error("Subscription cancellation error:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
