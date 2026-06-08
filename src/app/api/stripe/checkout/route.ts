import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSessionSchema } from "@/lib/validations/subscription";
import { getTestModeMetadata, logTestModeInfo, getTestModeCheckoutOptions, getTrialPeriodDays, getStripeConfig } from "@/lib/stripe-config";
import { normalizeBrowserUrl } from "@/lib/utils/url";
import { getSiteUrl } from "@/lib/utils/siteUrl";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = createCheckoutSessionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid request", details: validationResult.error.format() }, { status: 400 });
    }

    const { planType } = validationResult.data;

    // Support both server-side and public environment variables for consistency
    const priceId =
      planType === "MONTHLY"
        ? (process.env.STRIPE_PLUS_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO)
        : (process.env.STRIPE_PLUS_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR);

    if (!priceId) {
      console.error(`Missing price ID for plan type: ${planType}`);
      return NextResponse.json({ error: "Subscription plan configuration error. Please contact support." }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        stripeCustomerId: true,
        hasReceivedFreeTrial: true,
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const stripe = getStripe();

    // Validate that the price exists in Stripe before creating checkout session
    try {
      await stripe.prices.retrieve(priceId);
    } catch (priceError: any) {
      if (priceError.type === "StripeInvalidRequestError" && priceError.code === "resource_missing") {
        const isDevelopment = process.env.NODE_ENV !== "production";
        const config = getStripeConfig();
        console.error(`Stripe price validation failed: ${priceId}`, priceError);

        return NextResponse.json(
          {
            error: isDevelopment
              ? `The Stripe price ID "${priceId}" does not exist in your ${config.isTestMode ? "test" : "live"} Stripe account.\n\n` +
                `To fix this issue:\n` +
                `1. Go to your Stripe Dashboard: ${config.isTestMode ? "https://dashboard.stripe.com/test/products" : "https://dashboard.stripe.com/products"}\n` +
                `2. Create or locate your subscription products and copy the Price IDs\n` +
                `3. Update the following environment variables:\n` +
                `   - NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO\n` +
                `   - NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR\n\n` +
                `Currently configured ${planType.toLowerCase()} price ID: ${priceId}\n\n` +
                `See docs/STRIPE_QUICK_START.md for detailed setup instructions.`
              : "This subscription plan is not currently available. Please contact support for assistance.",
          },
          { status: 400 }
        );
      }
      // If it's another error, log it but continue (maybe transient network issue)
      console.warn(`Failed to validate price ${priceId}, continuing anyway:`, priceError);
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const now = new Date();
    const trialEligible = !user.hasReceivedFreeTrial;
    const trialPeriodDays = getTrialPeriodDays();

    logTestModeInfo("Creating checkout session", {
      userId: user.id,
      planType,
      trialEligible,
      trialPeriodDays,
      customerId,
    });

    // Do NOT write an INCOMPLETE subscription to the DB here.
    // The payment gate treats INCOMPLETE as "not paid" and blocks dashboard access.
    // The webhook (customer.subscription.updated → ACTIVE/TRIALING) writes the real
    // record once payment is confirmed. The auto-sync in payment-status.service.ts
    // handles the brief window between Stripe redirect and webhook delivery.

    // Use env-driven site URL so Stripe redirect URLs never use the bind address (0.0.0.0:3000).
    const baseUrl = normalizeBrowserUrl(process.env.NEXT_PUBLIC_APP_URL || getSiteUrl());

    const checkoutSessionParams: any = {
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/onboarding/details?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/onboarding/plans?canceled=true`,
      phone_number_collection: { enabled: true },
      metadata: getTestModeMetadata({
        userId: user.id,
        planType,
      }),
      subscription_data: {
        metadata: getTestModeMetadata({
          userId: user.id,
          planType,
        }),
      },
      ...getTestModeCheckoutOptions(),
    };

    if (trialEligible) {
      checkoutSessionParams.subscription_data.trial_period_days = trialPeriodDays;
    }

    const idempotencyKey = `checkout_${user.id}_${planType}_${Date.now()}`;

    let checkoutSession;
    try {
      checkoutSession = await stripe.checkout.sessions.create(checkoutSessionParams, {
        idempotencyKey,
      });
    } catch (stripeError: any) {
      // Handle Stripe-specific errors with better messages
      if (stripeError.type === "StripeInvalidRequestError" && stripeError.code === "resource_missing") {
        const isDevelopment = process.env.NODE_ENV !== "production";
        const config = getStripeConfig();
        console.error(`Stripe price not found: ${priceId}`, stripeError);

        return NextResponse.json(
          {
            error: isDevelopment
              ? `The Stripe price ID "${priceId}" does not exist in your Stripe account. Please verify your Stripe configuration:\n\n` +
                `1. Check that the price ID exists in your Stripe Dashboard (${config.isTestMode ? "https://dashboard.stripe.com/test/products" : "https://dashboard.stripe.com/products"})\n` +
                `2. Ensure you're using the correct Stripe API keys (${config.isTestMode ? "test mode" : "live mode"})\n` +
                `3. Update NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO and NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR in your environment variables\n\n` +
                `See docs/STRIPE_QUICK_START.md for setup instructions.`
              : "This subscription plan is not currently available. Please contact support for assistance.",
          },
          { status: 400 }
        );
      }

      // Re-throw other Stripe errors to be handled by the outer catch
      throw stripeError;
    }

    logTestModeInfo("Checkout session created", {
      sessionId: checkoutSession.id,
      customerId,
      trialEligible,
      url: checkoutSession.url,
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      trialEligible,
    });
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
