import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { calculateDeletionDeadline, getAccountCleanupConfig } from "@/lib/utils/accountCleanup";
import { emailService } from "@/lib/services/email.service";
import type { PlanType, Prisma, SubscriptionStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  stripeCustomerId: true,
};

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>; // prettier-ignore
type SubscriptionWithUser = Prisma.SubscriptionGetPayload<{ include: { user: { select: typeof userSelect } } }>; // prettier-ignore
type SubscriptionStatusEnum = SubscriptionStatus;
type PlanTypeEnum = PlanType;

type SubscriptionSyncResult = {
  subscription: SubscriptionWithUser;
  previousStatus: SubscriptionStatusEnum | null;
  previousCancelAt: Date | null;
  planPriceId: string | null;
  planLookupKey: string | null;
  planNickname: string | null;
  planProductId: string | null;
  user: SelectedUser;
};

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

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const result = await syncSubscription(subscription, event.id, event.type);
        if (result) {
          await maybeSendConfirmationEmail(result, event.type);
          await maybeSendCancellationEmail(result, event.type);
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailure(invoice);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook processing error", error);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(
  stripeSubscription: Stripe.Subscription,
  eventId: string,
  eventType: string,
): Promise<SubscriptionSyncResult | null> {
  const stripeSubscriptionId = stripeSubscription.id;
  if (!stripeSubscriptionId) {
    console.warn("Received subscription event without an ID", { eventType });
    return null;
  }

  const customerId = getStripeCustomerId(stripeSubscription.customer);
  const metadataUserId = stripeSubscription.metadata?.userId ?? stripeSubscription.metadata?.userID ?? null;

  const orFilters: Prisma.SubscriptionWhereInput[] = [{ stripeSubscriptionId }];
  if (metadataUserId) {
    orFilters.push({ userId: metadataUserId });
  }
  if (customerId) {
    orFilters.push({ stripeCustomerId: customerId });
  }

  let existing = await prisma.subscription.findFirst({
    where: { OR: orFilters },
    include: { user: { select: userSelect } },
  });

  let user = existing?.user ?? null;

  if (!user && metadataUserId) {
    user = await prisma.user.findUnique({ where: { id: metadataUserId }, select: userSelect });
  }

  if (!user && customerId) {
    user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: userSelect });
  }

  if (!user) {
    user = await findUserFallback({ customerId, email: stripeSubscription.customer_email ?? null });
  }

  if (!user) {
    console.warn(`No user found for subscription ${stripeSubscriptionId}`);
    return null;
  }

  const previousStatus = existing?.status ?? null;
  const previousCancelAt = existing?.cancelAt ?? null;

  const priceItem = stripeSubscription.items?.data?.[0];
  const planPriceId = priceItem?.price?.id ?? null;
  const planLookupKey = priceItem?.price?.lookup_key ?? null;
  const planNickname = priceItem?.price?.nickname ?? null;
  const planProductId = (() => {
    const product = priceItem?.price?.product;
    if (!product) {
      return null;
    }
    return typeof product === "string" ? product : product.id ?? null;
  })();

  const billingCycle = deriveBillingCycle([planLookupKey, planNickname, planPriceId]);
  const planType = toPlanType(billingCycle) ?? existing?.planType ?? null;

  const status = mapStripeStatus(stripeSubscription.status);
  const currentPeriodStart = toDate(stripeSubscription.current_period_start);
  const currentPeriodEnd = toDate(stripeSubscription.current_period_end);
  const cancelAt = toDate(stripeSubscription.cancel_at);
  const canceledAt = toDate(stripeSubscription.canceled_at);
  const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end ?? false;
  const trialStart = toDate(stripeSubscription.trial_start);
  const trialEnd = toDate(stripeSubscription.trial_end);
  const endedAt = toDate(stripeSubscription.ended_at);
  const latestInvoiceId = typeof stripeSubscription.latest_invoice === "string"
    ? stripeSubscription.latest_invoice
    : stripeSubscription.latest_invoice?.id ?? null;

  const { gracePeriodDays } = getAccountCleanupConfig();
  const cancellationReference = cancelAt ?? currentPeriodEnd ?? canceledAt ?? null;
  const computedGracePeriodEndsAt =
    (cancelAtPeriodEnd || status === "CANCELED") && cancellationReference
      ? calculateDeletionDeadline(cancellationReference, gracePeriodDays)
      : null;
  const shouldClearGrace = !cancelAtPeriodEnd && status !== "CANCELED";

  const stripeCustomerIdValue =
    customerId ?? existing?.stripeCustomerId ?? existing?.customerId ?? user.stripeCustomerId ?? null;
  const billingCycleValue = billingCycle ?? existing?.billingCycle ?? null;
  const priceIdValue = planPriceId ?? existing?.priceId ?? null;
  const planProductIdValue = planProductId ?? existing?.planProductId ?? null;
  const planLookupKeyValue = planLookupKey ?? existing?.planLookupKey ?? null;
  const planNicknameValue = planNickname ?? existing?.planNickname ?? null;
  const canceledAtValue = canceledAt ?? existing?.canceledAt ?? null;
  const gracePeriodEndsAtValue = shouldClearGrace
    ? null
    : computedGracePeriodEndsAt ?? existing?.gracePeriodEndsAt ?? null;
  const deletionScheduledAtValue = shouldClearGrace
    ? null
    : computedGracePeriodEndsAt ?? existing?.deletionScheduledAt ?? null;

  const subscriptionPayload = {
    userId: user.id,
    customerId: stripeCustomerIdValue,
    stripeSubscriptionId,
    stripeCustomerId: stripeCustomerIdValue,
    status,
    planType,
    billingCycle: billingCycleValue,
    priceId: priceIdValue,
    planProductId: planProductIdValue,
    planLookupKey: planLookupKeyValue,
    planNickname: planNicknameValue,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAt,
    cancelAtPeriodEnd,
    canceledAt: canceledAtValue,
    gracePeriodEndsAt: gracePeriodEndsAtValue,
    deletionScheduledAt: deletionScheduledAtValue,
    trialStart,
    trialEnd,
    endedAt,
    latestInvoiceId,
    lastEventId: eventId,
  };

  const updatedSubscription = await prisma.subscription.upsert({
    where: { userId: user.id },
    create: subscriptionPayload,
    update: subscriptionPayload,
    include: { user: { select: userSelect } },
  });

  const nextPlan = planPriceId ?? user.plan;
  const userUpdate: Prisma.UserUpdateInput = {
    plan: nextPlan,
    trialEnd,
  };

  if (isActiveOrTrialing(stripeSubscription.status)) {
    await prisma.$transaction([
      prisma.accountDeletionReminder.deleteMany({ where: { userId: user.id } }),
      prisma.user.update({ where: { id: user.id }, data: userUpdate }),
    ]);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: userUpdate });
  }

  return {
    subscription: updatedSubscription,
    previousStatus,
    previousCancelAt,
    planPriceId,
    planLookupKey,
    planNickname,
    planProductId,
    user: updatedSubscription.user,
  };
}

async function handlePaymentFailure(invoice: Stripe.Invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return;
  }

  const subscriptionRecord = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { user: { select: userSelect } },
  });

  const user = subscriptionRecord?.user;
  if (!user?.email) {
    return;
  }

  const planName = derivePlanName(null, invoice);
  await emailService.sendSubscriptionEmail({
    type: "payment_failure",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    planName,
    status: subscriptionRecord?.status ?? null,
    invoiceUrl: invoice.hosted_invoice_url ?? null,
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
  });
}

async function maybeSendConfirmationEmail(result: SubscriptionSyncResult, eventType: string) {
  if (!result.user?.email) {
    return;
  }

  const becameActive =
    (result.subscription.status === "ACTIVE" || result.subscription.status === "TRIALING") &&
    result.previousStatus !== result.subscription.status;

  if (!becameActive) {
    return;
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
  if (!result.user?.email) {
    return;
  }

  const cancellationScheduled = !result.previousCancelAt && !!result.subscription.cancelAt;
  const newlyCanceled =
    result.subscription.status === "CANCELED" && result.previousStatus !== "CANCELED";

  if (!cancellationScheduled && !newlyCanceled) {
    return;
  }

  const planName = derivePlanName(result);
  const cancellationDate =
    result.subscription.cancelAt ??
    result.subscription.canceledAt ??
    result.subscription.currentPeriodEnd ??
    null;

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
    return (
      result.planNickname ??
      result.planLookupKey ??
      result.planPriceId ??
      result.planProductId ??
      null
    );
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
  const normalized = status?.toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

function mapStripeStatus(status: Stripe.Subscription.Status | string | null | undefined): SubscriptionStatusEnum {
  switch ((status ?? "").toLowerCase()) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "unpaid":
      return "UNPAID";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "incomplete":
      return "INCOMPLETE";
    default:
      return "INCOMPLETE";
  }
}

function deriveBillingCycle(values: Array<string | null | undefined>): string | null {
  const normalized = values
    .filter((value): value is string => !!value)
    .map((value) => value.toLowerCase());

  if (normalized.some((value) => value.includes("annual") || value.includes("year"))) {
    return "ANNUAL";
  }

  if (normalized.some((value) => value.includes("month"))) {
    return "MONTHLY";
  }

  return null;
}

function toPlanType(value: string | null): PlanTypeEnum | null {
  if (!value) {
    return null;
  }

  const normalized = value.toUpperCase();
  if (normalized.includes("ANNUAL")) {
    return "ANNUAL";
  }
  if (normalized.includes("MONTH")) {
    return "MONTHLY";
  }

  return null;
}

function getStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) {
    return null;
  }

  return typeof customer === "string" ? customer : customer.id;
}
