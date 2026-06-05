import Stripe from "stripe";
import { prisma } from "../database/prisma";
import { emailService } from "./email.service";
import { slackService } from "./slack.service";
import { calculateDeletionDeadline, getAccountCleanupConfig } from "../utils/accountCleanup";
import { runNonCritical } from "../utils/nonCritical";
import { PlanType, SubscriptionStatus, Prisma } from "@prisma/client";
import { sendCapiEvent } from "../analytics/meta-capi";
import { invalidatePaymentStatusCache } from "./payment-status.service";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://opletics.com").replace(/\/$/, "");

const userSelect = {
  id: true,
  email: true,
  name: true,
  plan: true,
  stripeCustomerId: true,
};

type SelectedUser = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type SubscriptionStatusEnum = SubscriptionStatus;
type PlanTypeEnum = PlanType;

interface SubscriptionSyncResult {
  subscription: any;
  previousStatus: SubscriptionStatusEnum | null;
  previousCancelAt: Date | null;
  planPriceId: string | null;
  planLookupKey: string | null;
  planNickname: string | null;
  planProductId: string | null;
  user: SelectedUser;
}

export class StripeWebhookService {
  async processWebhookEvent(payload: { event: Stripe.Event; rawBody?: string }) {
    // Handle new payload format from queue
    const event = payload.event || payload;
    
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const result = await this.syncSubscription(subscription, event.id, event.type);
        if (result) {
          await this.maybeSendConfirmationEmail(result, event.type);
          await this.maybeSendCancellationEmail(result, event.type);
          // Invalidate cached payment status so the next middleware hit picks up the change
          const uid = (result as any).userId ?? (result as any).user?.id;
          if (uid) invalidatePaymentStatusCache(uid);
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentSuccess(invoice);
        // Invalidate by customer if we can resolve the userId
        this.invalidateCacheByCustomer(invoice.customer as string).catch(() => {});
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailure(invoice);
        this.invalidateCacheByCustomer(invoice.customer as string).catch(() => {});
        break;
      }
      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        await this.handleCustomerCreated(customer);
        break;
      }
    }
    
    // Mark event as processed in log
    await prisma.stripeWebhookEvent.update({
      where: { id: event.id },
      data: { status: "PROCESSED", processedAt: new Date() }
    });
  }

  private async syncSubscription(stripeSubscription: Stripe.Subscription, eventId: string, eventType: string): Promise<SubscriptionSyncResult | null> {
    const stripeSubscriptionId = stripeSubscription.id;
    const customerId = typeof stripeSubscription.customer === 'string' ? stripeSubscription.customer : stripeSubscription.customer?.id;
    const metadataUserId = stripeSubscription.metadata?.userId ?? stripeSubscription.metadata?.userID ?? null;

    const orFilters: Prisma.SubscriptionWhereInput[] = [{ stripeSubscriptionId }];
    if (metadataUserId) {
      orFilters.push({ userId: metadataUserId });
    }
    if (customerId) {
      orFilters.push({ stripeCustomerId: customerId });
    }

    const existing = await prisma.subscription.findFirst({
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
      console.warn(`No user found for subscription ${stripeSubscriptionId}`);
      return null;
    }

    const previousStatus = existing?.status ?? null;
    const previousCancelAt = existing?.cancelAt ?? null;

    const priceItem = stripeSubscription.items?.data?.[0];
    const planPriceId = priceItem?.price?.id ?? null;
    const planLookupKey = priceItem?.price?.lookup_key ?? null;
    const planNickname = priceItem?.price?.nickname ?? null;
    const planProductId = typeof priceItem?.price?.product === 'string' ? priceItem.price.product : priceItem?.price?.product?.id ?? null;

    const billingCycle = this.deriveBillingCycle([planLookupKey, planNickname, planPriceId]);
    const planType = this.toPlanType(billingCycle) ?? (existing?.planType as PlanType) ?? null;

    const status = this.mapStripeStatus(stripeSubscription.status);
    const sub = stripeSubscription as any;
    const currentPeriodStart = this.toDate(sub.current_period_start ?? sub.start_date);
    const currentPeriodEnd = this.toDate(sub.current_period_end ?? sub.ended_at);
    const cancelAt = this.toDate(stripeSubscription.cancel_at);
    const canceledAt = this.toDate(stripeSubscription.canceled_at);
    const cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end ?? false;
    const trialStart = this.toDate(stripeSubscription.trial_start);
    const trialEnd = this.toDate(stripeSubscription.trial_end);
    const endedAt = this.toDate(stripeSubscription.ended_at);
    const latestInvoiceId = typeof stripeSubscription.latest_invoice === "string" ? stripeSubscription.latest_invoice : (stripeSubscription.latest_invoice?.id ?? null);

    const { gracePeriodDays } = getAccountCleanupConfig();
    const cancellationReference = cancelAt ?? currentPeriodEnd ?? canceledAt ?? null;
    const computedGracePeriodEndsAt = (cancelAtPeriodEnd || status === "CANCELED") && cancellationReference ? calculateDeletionDeadline(cancellationReference, gracePeriodDays) : null;
    const shouldClearGrace = !cancelAtPeriodEnd && status !== "CANCELED";

    const subscriptionPayload = {
      userId: user.id,
      stripeSubscriptionId,
      stripeCustomerId: customerId ?? user.stripeCustomerId,
      status,
      planType,
      billingCycle: billingCycle ?? existing?.billingCycle,
      priceId: planPriceId ?? existing?.priceId,
      planProductId: planProductId ?? existing?.planProductId,
      planLookupKey: planLookupKey ?? existing?.planLookupKey,
      planNickname: planNickname ?? existing?.planNickname,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAt,
      cancelAtPeriodEnd,
      canceledAt,
      gracePeriodEndsAt: shouldClearGrace ? null : (computedGracePeriodEndsAt ?? existing?.gracePeriodEndsAt),
      deletionScheduledAt: shouldClearGrace ? null : (computedGracePeriodEndsAt ?? existing?.deletionScheduledAt),
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

    if (this.isActiveOrTrialing(stripeSubscription.status)) {
      await prisma.$transaction([
        prisma.accountDeletionReminder.deleteMany({ where: { userId: user.id } }), 
        prisma.user.update({ where: { id: user.id }, data: userUpdate })
      ]);
    } else {
      await prisma.user.update({ where: { id: user.id }, data: userUpdate });
    }

    // Meta CAPI — StartTrial fires once when a new trialing subscription is created
    const isNewTrial =
      eventType === "customer.subscription.created" &&
      stripeSubscription.status === "trialing" &&
      trialStart != null;

    if (isNewTrial && user.email) {
      void runNonCritical(
        () => sendCapiEvent({
          eventName: "StartTrial",
          eventId: `trial_${stripeSubscription.id}`,
          sourceUrl: `${SITE_URL}/onboarding/plans`,
          userData: { email: user.email },
          customData: { content_name: planNickname ?? planLookupKey ?? "Opletics Trial" },
        }),
        `[Meta CAPI] StartTrial for user ${user.id}`,
      );
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

  private async handlePaymentSuccess(invoice: Stripe.Invoice) {
    const inv = invoice as any;
    const subscriptionId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
    if (!subscriptionId) return;

    const subscriptionRecord = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { user: { select: userSelect } },
    });

    const user = subscriptionRecord?.user;
    if (!user?.email) return;

    try {
      const { autoEnableOnPayment } = await import("./account-disable.service");
      await autoEnableOnPayment(user.id);
    } catch (error) {
      console.error('[Webhook] Error auto-enabling account:', error);
    }

    const planName = this.derivePlanName(null, invoice);

    // Meta CAPI — Purchase (server-side, most reliable signal)
    // Use the Stripe invoice ID as the event_id; the browser pixel on the success
    // page should fire with the same ID for deduplication.
    void runNonCritical(
      () => sendCapiEvent({
        eventName: "Purchase",
        eventId: invoice.id,
        sourceUrl: `${SITE_URL}/onboarding/plans`,
        userData: { email: user.email },
        customData: {
          value: invoice.amount_paid / 100,
          currency: (invoice.currency ?? "usd").toUpperCase(),
          content_name: planName ?? "Opletics Subscription",
        },
      }),
      `[Meta CAPI] Purchase for user ${user.id}`,
    );

    void runNonCritical(
      async () => {
        await emailService.sendSubscriptionEmail({
          type: 'payment_success',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          planName: planName || 'Subscription',
          status: subscriptionRecord?.status ?? null,
          invoiceUrl: invoice.hosted_invoice_url ?? null,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          paidAt: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
        });
      },
      `invoice email for user ${user.id}`,
    );
  }

  private async handlePaymentFailure(invoice: Stripe.Invoice) {
    const inv2 = invoice as any;
    const subscriptionId = typeof inv2.subscription === 'string' ? inv2.subscription : inv2.subscription?.id;
    if (!subscriptionId) return;

    const subscriptionRecord = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
      include: { user: { select: userSelect } },
    });

    const user = subscriptionRecord?.user;
    if (!user?.email) return;

    const planName = this.derivePlanName(null, invoice);
    await emailService.sendSubscriptionEmail({
      type: "payment_failure",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      planName: planName || 'Subscription',
      status: subscriptionRecord?.status ?? null,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    });
  }

  private async handleCustomerCreated(customer: Stripe.Customer) {
    const email = customer.email;
    if (!email) return;

    const user = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });

    if (!user) return;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customer.id,
      },
    });
  }

  private async maybeSendConfirmationEmail(result: SubscriptionSyncResult, eventType: string) {
    if (!result.user?.email) return;

    const becameActive = (result.subscription.status === "ACTIVE" || result.subscription.status === "TRIALING") && result.previousStatus !== result.subscription.status;
    if (!becameActive) return;

    const planName = this.derivePlanName(result);
    const previousUserPlan = result.user.plan?.toLowerCase() || "free";
    const isUpgrade = previousUserPlan === "free" || previousUserPlan === "free_plan" || !result.user.plan;

    await emailService.sendSubscriptionEmail({
      type: isUpgrade ? "upgrade" : "confirmation",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      planName: planName || 'Subscription',
      status: result.subscription.status,
      currentPeriodEnd: result.subscription.currentPeriodEnd ?? result.subscription.trialEnd,
      previousPlan: isUpgrade ? "Free Plan" : undefined,
    });

    slackService.sendSignupNotification({
      time: new Date().toISOString(),
      endpoint: '/api/stripe/webhook',
      customer: `${result.user.name || 'User'} (${result.user.email})`,
      body: `Plan: ${planName || 'Unknown'} | Status: ${result.subscription.status} | Previous Plan: ${result.user.plan || 'None'}`,
    }).catch(err => console.error('Failed to send Slack notification:', err));
  }

  private async maybeSendCancellationEmail(result: SubscriptionSyncResult, eventType: string) {
    if (!result.user?.email) return;

    const cancellationScheduled = !result.previousCancelAt && !!result.subscription.cancelAt;
    const newlyCanceled = result.subscription.status === "CANCELED" && result.previousStatus !== "CANCELED";

    if (!cancellationScheduled && !newlyCanceled) return;

    const planName = this.derivePlanName(result);
    const cancellationDate = result.subscription.cancelAt ?? result.subscription.canceledAt ?? result.subscription.currentPeriodEnd ?? null;

    await emailService.sendSubscriptionEmail({
      type: "cancellation",
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      planName: planName || 'Subscription',
      status: result.subscription.status,
      currentPeriodEnd: result.subscription.currentPeriodEnd ?? result.subscription.trialEnd,
      cancellationDate,
    });
  }

  private derivePlanName(result?: SubscriptionSyncResult | null, invoice?: Stripe.Invoice): string | null {
    if (result) {
      return result.planNickname ?? result.planLookupKey ?? result.planPriceId ?? result.planProductId ?? null;
    }

    if (invoice) {
      const line = (invoice.lines?.data?.[0]) as any;
      return line?.price?.nickname ?? line?.price?.lookup_key ?? line?.price?.id ?? null;
    }

    return null;
  }

  private toDate(timestamp: number | null | undefined): Date | null {
    return timestamp ? new Date(timestamp * 1000) : null;
  }

  private isActiveOrTrialing(status: string | null | undefined): boolean {
    const normalized = status?.toLowerCase();
    return normalized === "active" || normalized === "trialing";
  }

  private mapStripeStatus(status: string | null | undefined): SubscriptionStatusEnum {
    switch ((status ?? "").toLowerCase()) {
      case "trialing": return "TRIALING";
      case "active": return "ACTIVE";
      case "past_due": return "PAST_DUE";
      case "canceled": return "CANCELED";
      case "unpaid": return "UNPAID";
      case "incomplete_expired": return "INCOMPLETE_EXPIRED";
      case "incomplete": return "INCOMPLETE";
      default: return "INCOMPLETE";
    }
  }

  private deriveBillingCycle(values: Array<string | null | undefined>): string | null {
    const normalized = values.filter((v): v is string => !!v).map(v => v.toLowerCase());
    if (normalized.some(v => v.includes("annual") || v.includes("year"))) return "ANNUAL";
    if (normalized.some(v => v.includes("month"))) return "MONTHLY";
    return null;
  }

  private toPlanType(value: string | null): PlanTypeEnum | null {
    if (!value) return null;
    const normalized = value.toUpperCase();
    if (normalized.includes("ANNUAL")) return "ANNUAL";
    if (normalized.includes("MONTH")) return "MONTHLY";
    return null;
  }

  private async invalidateCacheByCustomer(customerId: string): Promise<void> {
    if (!customerId) return;
    const sub = await prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      select: { userId: true },
    });
    if (sub?.userId) invalidatePaymentStatusCache(sub.userId);
  }
}

export const stripeWebhookService = new StripeWebhookService();
