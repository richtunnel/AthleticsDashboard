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
    
    // Check if the user is in a free trial
    const isTrialing = user.subscription.status === "TRIALING" || 
                      (user.subscription.trialEnd && new Date() < user.subscription.trialEnd);

    // Force immediate cancellation if in trial to ensure no charges are made
    const effectiveImmediately = immediately || isTrialing;

    const canceledSubscription = effectiveImmediately
      ? await stripe.subscriptions.cancel(user.subscription.stripeSubscriptionId)
      : await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

    const cancelAt = canceledSubscription.cancel_at
      ? new Date(canceledSubscription.cancel_at * 1000)
      : null;
    const canceledAtFromStripe = canceledSubscription.canceled_at
      ? new Date(canceledSubscription.canceled_at * 1000)
      : null;
    const canceledAt = effectiveImmediately ? new Date() : canceledAtFromStripe;

    const firstItemPeriodEnd = canceledSubscription.items.data[0]?.current_period_end;
    const currentPeriodEnd = typeof firstItemPeriodEnd === "number" ? new Date(firstItemPeriodEnd * 1000) : null;

    const cancelAtPeriodEnd = canceledSubscription.cancel_at_period_end ?? false;
    const { gracePeriodDays } = getAccountCleanupConfig();
    const graceReference = cancelAt ?? currentPeriodEnd ?? canceledAt;
    const gracePeriodEndsAt = graceReference
      ? calculateDeletionDeadline(graceReference, gracePeriodDays)
      : null;

    const { status: currentStatus, canceledAt: currentCanceledAt, deletionScheduledAt: currentDeletionScheduledAt } = user.subscription;

    const updatedSubscription = await prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.update({
        where: { userId: user.id },
        data: {
          status: effectiveImmediately ? "CANCELED" : currentStatus,
          cancelAt,
          cancelAtPeriodEnd,
          canceledAt: canceledAt ?? currentCanceledAt,
          currentPeriodEnd,
          gracePeriodEndsAt,
          deletionScheduledAt: gracePeriodEndsAt ?? currentDeletionScheduledAt,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          hasReceivedFreeTrial: true,
          cancellationDate: new Date(),
        },
      });

      return sub;
    });

    return NextResponse.json({
      success: true,
      message: effectiveImmediately
        ? isTrialing ? "Trial subscription canceled successfully. No charges will be made." : "Subscription canceled immediately"
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
