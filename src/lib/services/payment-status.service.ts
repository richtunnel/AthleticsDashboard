/**
 * Payment Status Service
 * 
 * Checks if a user's payment is overdue and should have dashboard access restricted.
 */

import { prisma } from "@/lib/database/prisma";
import type { Subscription, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";

const PAYMENT_GRACE_HOURS = 48;

// ── In-process payment status cache ─────────────────────────────────────────
// Eliminates a DB query on every /dashboard/* middleware hit.
// TTL is short (5 min) so changes from Stripe webhooks propagate quickly.
const PAYMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const _paymentCache = new Map<string, { result: PaymentStatusResult; expiresAt: number }>();

/** Invalidate a cached entry — call from Stripe webhook handlers on status changes. */
export function invalidatePaymentStatusCache(userId: string): void {
  _paymentCache.delete(userId);
}

export interface PaymentStatusResult {
  isOverdue: boolean;
  hoursOverdue?: number;
  dueDate?: Date;
  status?: SubscriptionStatus;
  shouldLockDashboard: boolean;
  isDisabled?: boolean;
  disableReason?: string | null;
  isCanceled?: boolean;
  periodEndDate?: Date;
  /** True when the AD has never completed Stripe checkout — redirect to /onboarding/plans */
  needsCheckout?: boolean;
}

/**
 * Check if a user's payment is overdue and dashboard should be locked
 */
export async function checkPaymentStatus(userId: string): Promise<PaymentStatusResult> {
  // Serve from cache to avoid a DB hit on every middleware request
  const cached = _paymentCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await _checkPaymentStatusFromDB(userId);
  _paymentCache.set(userId, { result, expiresAt: Date.now() + PAYMENT_CACHE_TTL_MS });
  return result;
}

/**
 * Pull the most recent non-incomplete subscription from Stripe and upsert it
 * into the local DB. Called as a one-time recovery when no DB record exists.
 * Returns true if a subscription was found and synced.
 */
async function syncSubscriptionFromStripe(userId: string, stripeCustomerId: string): Promise<boolean> {
  const { getStripe } = await import("@/lib/stripe");
  const stripe = getStripe();

  // List active subscriptions for this customer; fall back to all statuses
  const { data: subscriptions } = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    limit: 10,
    expand: ["data.latest_invoice"],
  });

  if (!subscriptions.length) return false;

  // Prefer ACTIVE > TRIALING > PAST_DUE > anything else
  const priority = ["active", "trialing", "past_due", "unpaid", "canceled"];
  const sorted = [...subscriptions].sort((a, b) => {
    const ai = priority.indexOf(a.status) === -1 ? 99 : priority.indexOf(a.status);
    const bi = priority.indexOf(b.status) === -1 ? 99 : priority.indexOf(b.status);
    return ai - bi;
  });

  const sub = sorted[0];
  if (!sub || sub.status === "incomplete" || sub.status === "incomplete_expired") return false;

  const statusMap: Record<string, SubscriptionStatus> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
    incomplete_expired: "INCOMPLETE_EXPIRED",
  };

  const priceItem = sub.items?.data?.[0];
  const planPriceId = priceItem?.price?.id ?? null;
  const planLookupKey = priceItem?.price?.lookup_key ?? null;
  const planNickname = priceItem?.price?.nickname ?? null;
  const s = sub as any;

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
      status: statusMap[sub.status] ?? "ACTIVE",
      priceId: planPriceId,
      planLookupKey,
      planNickname,
      currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000) : null,
      currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      lastEventId: "auto-sync",
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId,
      status: statusMap[sub.status] ?? "ACTIVE",
      priceId: planPriceId,
      planLookupKey,
      planNickname,
      currentPeriodStart: s.current_period_start ? new Date(s.current_period_start * 1000) : null,
      currentPeriodEnd: s.current_period_end ? new Date(s.current_period_end * 1000) : null,
      trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      lastEventId: "auto-sync",
    },
  });

  return true;
}

async function _checkPaymentStatusFromDB(userId: string): Promise<PaymentStatusResult> {
  try {
    // Fetch account status, role, member-access flag, and Stripe customer ID in one query
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        isDisabled: true,
        disableReason: true,
        role: true,
        isMemberAccess: true,
        stripeCustomerId: true,
      },
    });

    // If account is disabled, lock dashboard regardless of payment status
    if (user?.isDisabled) {
      return {
        isOverdue: true,
        shouldLockDashboard: true,
        isDisabled: true,
        disableReason: user.disableReason,
      };
    }

    // Super admins are exempt from all billing checks
    if (user?.role === 'SUPER_ADMIN') {
      return {
        isOverdue: false,
        shouldLockDashboard: false,
        isDisabled: false,
      };
    }

    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Athletic Directors must complete Stripe checkout before accessing the dashboard.
    // Member-access (demo) sessions and non-AD roles (collaborators, parents) are exempt.
    const isAD = user?.role === 'ATHLETIC_DIRECTOR';
    const isMember = Boolean(user?.isMemberAccess);

    // ── Stripe auto-sync fallback ─────────────────────────────────────────────
    // No DB subscription record found, but the user has a Stripe customer ID.
    // This can happen when a webhook was missed (endpoint down, misconfigured)
    // or after a DB migration. Try to recover by fetching from Stripe directly
    // and writing the record now. Only runs once per user — after the upsert the
    // DB record exists and subsequent calls skip this entirely.
    if (!subscription && isAD && !isMember && user?.stripeCustomerId) {
      try {
        const synced = await syncSubscriptionFromStripe(userId, user.stripeCustomerId);
        if (synced) {
          subscription = await prisma.subscription.findUnique({ where: { userId } });
          console.log(`[PaymentStatus] Auto-synced subscription from Stripe for user ${userId}`);
        }
      } catch (syncErr) {
        console.error('[PaymentStatus] Stripe auto-sync failed:', syncErr);
        // Fall through — still redirect to checkout below
      }
    }

    if (!subscription && isAD && !isMember) {
      return {
        isOverdue: false,
        shouldLockDashboard: true,
        needsCheckout: true,
        isDisabled: false,
      };
    }

    // No subscription = non-AD role (collaborator, parent, etc.) — no lock
    if (!subscription) {
      return {
        isOverdue: false,
        shouldLockDashboard: false,
        isDisabled: false,
      };
    }

    // Expired incomplete checkout — AD must restart Stripe checkout
    if (subscription.status === 'INCOMPLETE_EXPIRED' && isAD && !isMember) {
      return {
        isOverdue: false,
        shouldLockDashboard: true,
        needsCheckout: true,
        status: subscription.status,
        isDisabled: false,
      };
    }

    // Active or trialing = full access
    if (
      subscription.status === 'ACTIVE' ||
      subscription.status === 'TRIALING'
    ) {
      return {
        isOverdue: false,
        shouldLockDashboard: false,
        status: subscription.status,
        isDisabled: false,
      };
    }

    // INCOMPLETE: The webhook now skips writing these records entirely, so this
    // branch only fires for records that existed before that fix was deployed.
    // Self-heal by deleting the stale record so the user can start a fresh
    // checkout. The delete is fire-and-forget; on error we still redirect them.
    if (subscription.status === 'INCOMPLETE') {
      try {
        await prisma.subscription.delete({ where: { userId } });
        invalidatePaymentStatusCache(userId);
        console.log(`[PaymentStatus] Self-healed stale INCOMPLETE subscription for user ${userId}`);
      } catch (err) {
        console.error('[PaymentStatus] Failed to delete stale INCOMPLETE subscription:', err);
      }
      // After cleanup, an AD still needs to complete checkout
      if (isAD && !isMember) {
        return {
          isOverdue: false,
          shouldLockDashboard: true,
          needsCheckout: true,
          status: subscription.status,
          isDisabled: false,
        };
      }
      // Non-AD roles: no lock
      return {
        isOverdue: false,
        shouldLockDashboard: false,
        status: subscription.status,
        isDisabled: false,
      };
    }

    // Check if payment is past_due or unpaid
    if (subscription.status === 'PAST_DUE' || subscription.status === 'UNPAID') {
      const dueDate = subscription.currentPeriodEnd;
      
      if (!dueDate) {
        // If no due date, check based on status change
        return {
          isOverdue: true,
          shouldLockDashboard: true,
          status: subscription.status,
          isDisabled: false,
        };
      }

      const now = new Date();
      const hoursSinceDue = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);

      // Lock dashboard if payment is more than 48 hours overdue
      const shouldLock = hoursSinceDue > PAYMENT_GRACE_HOURS;

      return {
        isOverdue: true,
        hoursOverdue: Math.floor(hoursSinceDue),
        dueDate,
        status: subscription.status,
        shouldLockDashboard: shouldLock,
        isDisabled: false,
      };
    }

    // Canceled — allow access until the paid period ends, then lock to billing-only
    if (subscription.status === 'CANCELED') {
      const periodEnd = subscription.currentPeriodEnd;
      const periodExpired = !periodEnd || periodEnd <= new Date();
      return {
        isOverdue: false,
        shouldLockDashboard: periodExpired,
        isCanceled: true,
        periodEndDate: periodEnd ?? undefined,
        status: subscription.status,
        isDisabled: false,
      };
    }

    // Other statuses = no lock
    return {
      isOverdue: false,
      shouldLockDashboard: false,
      status: subscription.status,
      isDisabled: false,
    };
  } catch (error) {
    console.error('[PaymentStatus] Error checking payment status:', error);
    // On error, don't lock the dashboard to prevent false positives
    return {
      isOverdue: false,
      shouldLockDashboard: false,
      isDisabled: false,
    };
  }
}

/**
 * Check if specific route should be accessible with overdue payment
 * Only /dashboard/settings and its subroutes should be accessible
 */
export function isRouteAllowedWhenOverdue(pathname: string): boolean {
  // Allow settings page and its subroutes
  if (pathname.startsWith('/dashboard/settings')) {
    return true;
  }

  // Allow API routes for settings functionality
  if (
    pathname.startsWith('/api/stripe') ||
    pathname.startsWith('/api/user/') ||
    pathname === '/api/auth/signout'
  ) {
    return true;
  }

  // Block everything else
  return false;
}

/**
 * Get user-friendly message for overdue payment
 */
export function getOverdueMessage(result: PaymentStatusResult): string {
  if (!result.isOverdue || !result.shouldLockDashboard) {
    return '';
  }

  const hoursOverdue = result.hoursOverdue || 0;
  const daysOverdue = Math.floor(hoursOverdue / 24);

  if (daysOverdue > 0) {
    return `Your payment is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue. Please update your payment method in Settings to restore full access.`;
  }

  if (hoursOverdue > 0) {
    return `Your payment is ${hoursOverdue} hour${hoursOverdue !== 1 ? 's' : ''} overdue. Please update your payment method in Settings to restore full access.`;
  }

  return `Your payment is overdue. Please update your payment method in Settings to restore full access.`;
}
