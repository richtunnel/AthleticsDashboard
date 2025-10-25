import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/database/prisma";
import { emailService } from "@/lib/services/email.service";
import type { Subscription as SubscriptionModel, User as UserModel } from "@prisma/client";

export const runtime = "nodejs";

const relevantEvents = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "customer.subscription.trial_will_end",
]);

const userSelect = {
  id: true,
  email: true,
  name: true,
  stripeCustomerId: true,
  subscriptionId: true,
  plan: true,
  hasReceivedFreeTrial: true,
  subscriptionStatus: true,
} as const;

type SelectedUser = Pick<
  UserModel,
  "id" | "email" | "name" | "stripeCustomerId" | "subscriptionId" | "plan" | "hasReceivedFreeTrial" | "subscriptionStatus"
>;

interface SubscriptionSyncOptions {
  fallbackUserId?: string | null;
  customerIdOverride?: string | null;
  customerEmailOverride?: string | null;
  metadataUserId?: string | null;
}

interface SubscriptionSyncResult {
  user: SelectedUser | null;
  subscription: SubscriptionModel;
  previousStatus: string | null;
  previousCancelAt: Date | null;
  transitionedToActiveOrTrial: boolean;
  planNickname: string | null;
  planLookupKey: string | null;
  planPriceId: string | null;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.warn("stripe.webhook.missing_signature");
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("stripe.webhook.missing_secret");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(Buffer.from(rawBody), signature, secret);
  } catch (error) {
    console.error("stripe.webhook.signature_verification_failed", {
      message: error instanceof Error ? error.message : "Unknown signature verification error",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (!relevantEvents.has(event.type)) {
    console.info("stripe.webhook.skipped_event", { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true });
  }

  console.info("stripe.webhook.received", { eventId: event.id, type: event.type });

  try {
    const alreadyProcessed = await prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
      select: { id: true },
    });

    if (alreadyProcessed) {
      console.info("stripe.webhook.duplicate_event", { eventId: event.id, type: event.type });
      return NextResponse.json({ received: true });
    }

    await handleEvent(stripe, event);

    await prisma.stripeWebhookEvent.create({
      data: {
        id: event.id,
        type: event.type,
      },
    });

    console.info("stripe.webhook.processed", { eventId: event.id, type: event.type });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe.webhook.processing_error", {
      eventId: event.id,
      type: event.type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json({ error: "Webhook handling error" }, { status: 500 });
  }
}

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(stripe, event);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleCustomerSubscriptionEvent(stripe, event);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(stripe, event);
      break;
    case "customer.subscription.trial_will_end":
      await handleTrialWillEnd(stripe, event);
      break;
    default:
      break;
  }
}

async function handleCheckoutSessionCompleted(stripe: Stripe, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!subscriptionId) {
    console.warn("stripe.webhook.checkout_missing_subscription", { eventId: event.id });
    return;
  }

  const fallbackUserId = session.metadata?.["userId"] ?? session.client_reference_id ?? null;
  const metadataUserId = session.metadata?.["userId"] ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const customerEmail = session.customer_details?.email ?? session.metadata?.["email"] ?? null;

  const result = await syncSubscription(stripe, subscriptionId, event.id, {
    fallbackUserId,
    customerIdOverride: customerId,
    customerEmailOverride: customerEmail,
    metadataUserId,
  });

  await maybeSendActivationEmail(result, event.type);
}

async function handleCustomerSubscriptionEvent(stripe: Stripe, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;

  if (!subscriptionId) {
    console.warn("stripe.webhook.subscription_missing_id", { eventId: event.id });
    return;
  }

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const result = await syncSubscription(stripe, subscriptionId, event.id, {
    fallbackUserId: subscription.metadata?.["userId"] ?? null,
    customerIdOverride: customerId,
    metadataUserId: subscription.metadata?.["userId"] ?? null,
  });

  await maybeSendActivationEmail(result, event.type);
  await maybeSendCancellationEmail(result, event.type);
}

async function handleInvoicePaymentFailed(stripe: Stripe, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  const customerEmail = (invoice as Stripe.Invoice & { customer_email?: string | null }).customer_email ?? null;

  const result = subscriptionId
    ? await syncSubscription(stripe, subscriptionId, event.id, {
        customerIdOverride: customerId,
        customerEmailOverride: customerEmail,
      })
    : null;

  const user = result?.user ?? (await findUserFallback({ customerId, email: customerEmail }));

  if (!user) {
    console.warn("stripe.webhook.payment_failed_user_not_found", {
      eventId: event.id,
      subscriptionId,
      customerId,
    });
    return;
  }

  const dueTimestamp = invoice.next_payment_attempt ?? invoice.due_date ?? null;
  const dueDate = toDate(dueTimestamp);
  const invoiceUrl = invoice.hosted_invoice_url ?? null;
  const planName = derivePlanName(result, invoice);

  await emailService.sendSubscriptionEmail({
    type: "payment_failure",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    planName,
    status: result?.subscription.status ?? user.subscriptionStatus ?? null,
    currentPeriodEnd: result?.subscription.currentPeriodEnd ?? null,
    dueDate,
    invoiceUrl,
  });

  console.info("stripe.webhook.email.payment_failure", {
    eventId: event.id,
    subscriptionId,
    userId: user.id,
  });
}

async function handleTrialWillEnd(stripe: Stripe, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;
  const subscriptionId = subscription.id;

  if (!subscriptionId) {
    console.warn("stripe.webhook.trial_missing_subscription", { eventId: event.id });
    return;
  }

  const result = await syncSubscription(stripe, subscriptionId, event.id, {
    fallbackUserId: subscription.metadata?.["userId"] ?? null,
    customerIdOverride: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
    metadataUserId: subscription.metadata?.["userId"] ?? null,
  });

  if (!result.user) {
    console.warn("stripe.webhook.trial_user_not_found", { subscriptionId, eventId: event.id });
    return;
  }

  const planName = derivePlanName(result);
  await emailService.sendSubscriptionEmail({
    type: "trial_ending",
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    planName,
    status: result.subscription.status,
    currentPeriodEnd: result.subscription.trialEnd ?? result.subscription.currentPeriodEnd,
  });

  console.info("stripe.webhook.email.trial_ending", {
    eventId: event.id,
    subscriptionId,
    userId: result.user.id,
  });
}

async function syncSubscription(
  stripe: Stripe,
  subscriptionId: string,
  eventId: string,
  options: SubscriptionSyncOptions = {}
): Promise<SubscriptionSyncResult> {
  const stripeSubscription = (await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  })) as Stripe.Subscription;

  const customerIdFromStripe =
    typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer?.id ?? null;
  const resolvedCustomerId = options.customerIdOverride ?? customerIdFromStripe;
  const resolvedCustomerEmail = options.customerEmailOverride ?? null;
  const metadataUserId = options.metadataUserId ?? stripeSubscription.metadata?.["userId"] ?? null;

  const price = stripeSubscription.items.data[0]?.price ?? null;
  let planProductId: string | null = null;
  let productName: string | null = null;

  const product = price?.product;
  if (product) {
    if (typeof product === "string") {
      planProductId = product;
    } else if ("deleted" in product && (product as Stripe.DeletedProduct).deleted) {
      planProductId = product.id ?? null;
    } else {
      planProductId = product.id ?? null;
      productName = (product as Stripe.Product).name ?? null;
    }
  }

  const planNickname = price?.nickname ?? productName;
  const planLookupKey = price?.lookup_key ?? null;
  const planPriceId = price?.id ?? null;

  const subscriptionAny = stripeSubscription as unknown as Record<string, unknown>;
  const currentPeriodStart = toDate(subscriptionAny.current_period_start as number | undefined);
  const currentPeriodEnd = toDate(subscriptionAny.current_period_end as number | undefined);
  const cancelAt = toDate(subscriptionAny.cancel_at as number | undefined);
  const cancelAtPeriodEnd = Boolean(subscriptionAny.cancel_at_period_end);
  const canceledAt = toDate(subscriptionAny.canceled_at as number | undefined);
  const trialStart = toDate(subscriptionAny.trial_start as number | undefined);
  const trialEnd = toDate(subscriptionAny.trial_end as number | undefined);
  const endedAt = toDate(subscriptionAny.ended_at as number | undefined);
  const latestInvoiceId = typeof subscriptionAny.latest_invoice === "string"
    ? (subscriptionAny.latest_invoice as string)
    : ((subscriptionAny.latest_invoice as { id?: string } | undefined)?.id ?? null);

  const existingSubscription = await prisma.subscription.findUnique({ where: { id: stripeSubscription.id } });

  let user: SelectedUser | null = null;

  if (options.fallbackUserId) {
    user = await prisma.user.findUnique({ where: { id: options.fallbackUserId }, select: userSelect });
  }

  if (!user && metadataUserId) {
    user = await prisma.user.findUnique({ where: { id: metadataUserId }, select: userSelect });
  }

  if (!user) {
    const orConditions: Array<Record<string, unknown>> = [{ subscriptionId: stripeSubscription.id }];
    if (resolvedCustomerId) {
      orConditions.push({ stripeCustomerId: resolvedCustomerId });
    }

    user = await prisma.user.findFirst({
      where: { OR: orConditions },
      select: userSelect,
    });
  }

  if (!user && resolvedCustomerEmail) {
    user = await prisma.user.findUnique({ where: { email: resolvedCustomerEmail }, select: userSelect });
  }

  const resolvedCustomerIdFinal =
    resolvedCustomerId ?? existingSubscription?.customerId ?? (customerIdFromStripe ?? "unknown");

  const previousStatus = existingSubscription?.status ?? null;
  const previousCancelAt = existingSubscription?.cancelAt ?? null;

  const subscriptionData = {
    customerId: resolvedCustomerIdFinal,
    status: stripeSubscription.status,
    planPriceId,
    planProductId,
    planLookupKey,
    planNickname,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAt,
    cancelAtPeriodEnd,
    canceledAt,
    trialStart,
    trialEnd,
    endedAt,
    latestInvoiceId,
    lastEventId: eventId,
  } satisfies Partial<SubscriptionModel> & { customerId: string; status: string; cancelAtPeriodEnd: boolean };

  const subscriptionRecord = await prisma.subscription.upsert({
    where: { id: stripeSubscription.id },
    create: { id: stripeSubscription.id, ...subscriptionData },
    update: subscriptionData,
  });

  let updatedUser: SelectedUser | null = user;

  if (user) {
    const isActive = isActiveOrTrialing(subscriptionRecord.status);
    const userUpdate: Record<string, unknown> = {
      subscriptionId: stripeSubscription.id,
      subscriptionStatus: subscriptionRecord.status,
      cancellationDate: subscriptionRecord.canceledAt,
      deletionScheduledAt: subscriptionRecord.cancelAt,
      trialEnd: subscriptionRecord.trialEnd,
    };

    if (resolvedCustomerIdFinal && user.stripeCustomerId !== resolvedCustomerIdFinal) {
      userUpdate.stripeCustomerId = resolvedCustomerIdFinal;
    }

    if (isActive) {
      userUpdate.plan = planLookupKey ?? planPriceId ?? user.plan ?? "paid";
    } else if (["canceled", "incomplete", "incomplete_expired", "unpaid"].includes(subscriptionRecord.status)) {
      userUpdate.plan = "free";
    }

    if (isActive && !user.hasReceivedFreeTrial) {
      userUpdate.hasReceivedFreeTrial = true;
    }

    updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: userUpdate,
      select: userSelect,
    });
  }

  const transitionedToActiveOrTrial = !isActiveOrTrialing(previousStatus) && isActiveOrTrialing(subscriptionRecord.status);

  return {
    user: updatedUser,
    subscription: subscriptionRecord,
    previousStatus,
    previousCancelAt,
    transitionedToActiveOrTrial,
    planNickname,
    planLookupKey,
    planPriceId,
  };
}

async function maybeSendActivationEmail(result: SubscriptionSyncResult, eventType: string) {
  if (!result.transitionedToActiveOrTrial || !result.user) {
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
