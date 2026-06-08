import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import type { SubscriptionStatus } from "@prisma/client";
import { invalidatePaymentStatusCache } from "@/lib/services/payment-status.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/stripe/sync-subscription
 *
 * Re-fetches the authenticated user's subscription data directly from Stripe
 * and upserts it into the local DB. Use this to recover from missed webhooks
 * or after a DB migration wiped subscription records.
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeCustomerId: true, role: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer ID on file. Please contact support." },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    const { data: subscriptions } = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      limit: 10,
    });

    if (!subscriptions.length) {
      return NextResponse.json(
        { error: "No Stripe subscriptions found for your account." },
        { status: 404 }
      );
    }

    // Prefer most-active subscription
    const priority = ["active", "trialing", "past_due", "unpaid", "canceled"];
    const sorted = [...subscriptions].sort((a, b) => {
      const ai = priority.indexOf(a.status) === -1 ? 99 : priority.indexOf(a.status);
      const bi = priority.indexOf(b.status) === -1 ? 99 : priority.indexOf(b.status);
      return ai - bi;
    });

    const sub = sorted[0];

    if (!sub || sub.status === "incomplete" || sub.status === "incomplete_expired") {
      return NextResponse.json(
        { error: "No active subscription found. Please complete checkout." },
        { status: 404 }
      );
    }

    const statusMap: Record<string, SubscriptionStatus> = {
      active: "ACTIVE",
      trialing: "TRIALING",
      past_due: "PAST_DUE",
      unpaid: "UNPAID",
      canceled: "CANCELED",
    };

    const priceItem = sub.items?.data?.[0];
    const planPriceId = priceItem?.price?.id ?? null;
    const planLookupKey = priceItem?.price?.lookup_key ?? null;
    const planNickname = priceItem?.price?.nickname ?? null;
    const s = sub as any;

    const payload = {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: user.stripeCustomerId,
      status: statusMap[sub.status] ?? "ACTIVE",
      priceId: planPriceId,
      planLookupKey,
      planNickname,
      currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000) : null,
      currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      lastEventId: "manual-sync",
    };

    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, ...payload },
      update: payload,
    });

    // Bust the 5-minute in-process cache so the next request re-evaluates
    invalidatePaymentStatusCache(userId);

    console.log(`[SyncSubscription] Synced subscription ${sub.id} (${sub.status}) for user ${userId}`);

    return NextResponse.json({
      success: true,
      subscriptionId: sub.id,
      status: sub.status,
      message: "Subscription synced successfully. You can now access your dashboard.",
    });
  } catch (error) {
    console.error("[SyncSubscription] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription. Please try again or contact support." },
      { status: 500 }
    );
  }
}
