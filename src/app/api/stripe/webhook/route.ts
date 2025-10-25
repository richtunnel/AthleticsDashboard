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

  const planName = derivePlanName(result);
  await emailService.sendSubscriptionEmail({
    type: "confirmation",
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    planName,
    status: result.subscription.status,
    currentPeriodEnd: result.subscription.currentPeriodEnd ?? result.subscription.trialEnd,
  });

  console.info("stripe.webhook.email.subscription_confirmation", {
    subscriptionId: result.subscription.id,
    userId: result.user.id,
    eventType,
  });
}

async function maybeSendCancellationEmail(result: SubscriptionSyncResult, eventType: string) {
  if (!result.user) {
    return;
  }

  const cancellationScheduled = !result.previousCancelAt && !!result.subscription.cancelAt;
  const newlyCanceled =
    result.subscription.status === "canceled" && result.previousStatus !== "canceled";

  if (!cancellationScheduled && !newlyCanceled) {
    return;
  }

  const planName = derivePlanName(result);
  const cancellationDate =
    result.subscription.cancelAt ?? result.subscription.canceledAt ?? result.subscription.currentPeriodEnd ?? null;

  await emailService.sendSubscriptionEmail({
    type: "cancellation",
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    planName,
    status: result.subscription.status,
    currentPeriodEnd: result.subscription.currentPeriodEnd ?? result.subscription.trialEnd,
    cancellationDate,
  });

  console.info("stripe.webhook.email.subscription_cancellation", {
    subscriptionId: result.subscription.id,
    userId: result.user.id,
    eventType,
  });
}

async function findUserFallback(params: { customerId?: string | null; email?: string | null }): Promise<SelectedUser | null> {
  if (params.customerId) {
    const byCustomer = await prisma.user.findFirst({
      where: { stripeCustomerId: params.customerId },
      select: userSelect,
    });
    if (byCustomer) {
      return byCustomer;
    }
  }

  if (params.email) {
    return prisma.user.findUnique({ where: { email: params.email }, select: userSelect });
  }

  return null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscriptionField = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!subscriptionField) {
    return null;
  }
  return typeof subscriptionField === "string" ? subscriptionField : subscriptionField.id;
}

type InvoiceLineWithPrice = Stripe.InvoiceLineItem & {
  plan?: { nickname?: string | null };
  price?: Stripe.Price | null;
};

function derivePlanName(result?: SubscriptionSyncResult | null, invoice?: Stripe.Invoice): string | null {
  if (result) {
    return result.planNickname ?? result.planLookupKey ?? result.planPriceId ?? null;
  }

  if (invoice) {
    const line = invoice.lines?.data?.[0] as InvoiceLineWithPrice | undefined;
    if (line?.plan?.nickname) {
      return line.plan.nickname;
    }
    if (line?.price?.nickname) {
      return line.price.nickname;
    }
    if (line?.price?.lookup_key) {
      return line.price.lookup_key;
    }
    if (line?.price?.id) {
      return line.price.id;
    }
  }

  return null;
}

function toDate(timestamp: number | null | undefined): Date | null {
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp * 1000);
}

function isActiveOrTrialing(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}
