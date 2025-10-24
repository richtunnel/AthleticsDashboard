import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateDeletionDeadline, getAccountCleanupConfig } from "@/lib/utils/accountCleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    if (!subscription.id) {
      console.warn("Received subscription event without an ID");
      return NextResponse.json({ received: true });
    }

    const user = await prisma.user.findUnique({
      where: { subscriptionId: subscription.id },
      select: {
        id: true,
        plan: true,
      },
    });

    if (!user) {
      console.warn(`No user found for subscription ${subscription.id}`);
      return NextResponse.json({ received: true });
    }

    const { gracePeriodDays } = getAccountCleanupConfig();
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;

    if (subscription.status === "active" || subscription.status === "trialing") {
      const nextPlan = subscription.items?.data?.[0]?.price?.id ?? user.plan;

      await prisma.$transaction([
        prisma.accountDeletionReminder.deleteMany({ where: { userId: user.id } }),
        prisma.user.update({
          where: { id: user.id },
          data: {
            plan: nextPlan,
            trialEnd,
            deletionScheduledAt: null,
          },
        }),
      ]);
    } else if (subscription.status === "canceled") {
      const cancellationDate = subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : new Date();
      const scheduledDeletion = calculateDeletionDeadline(cancellationDate, gracePeriodDays);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          trialEnd,
          deletionScheduledAt: scheduledDeletion,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          trialEnd,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
