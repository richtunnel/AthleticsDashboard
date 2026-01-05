import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSessionByPriceSchema } from "@/lib/validations/subscription";
import { getTestModeMetadata, logTestModeInfo, getTestModeCheckoutOptions, getTrialPeriodDays, getStripeConfig } from "@/lib/stripe-config";
import { normalizeBrowserUrl } from "@/lib/utils/url";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const priceIdToPlanTypeMap: Record<string, "MONTHLY" | "ANNUAL"> = (() => {
  const mapping: Record<string, "MONTHLY" | "ANNUAL"> = {};

  // Support both server-side and public environment variables
  // This ensures the frontend and backend use consistent price IDs
  const standardMo = process.env.STRIPE_STANDARD_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO;
  const standardYr = process.env.STRIPE_STANDARD_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR;
  const teamMo = process.env.STRIPE_TEAM_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO;
  const teamYr = process.env.STRIPE_TEAM_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR;
  const plusMo = process.env.STRIPE_PLUS_PRICE_ID_MO || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO;
  const plusYr = process.env.STRIPE_PLUS_PRICE_ID_YR || process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR;

  if (standardMo) mapping[standardMo] = "MONTHLY";
  if (standardYr) mapping[standardYr] = "ANNUAL";
  if (teamMo) mapping[teamMo] = "MONTHLY";
  if (teamYr) mapping[teamYr] = "ANNUAL";
  if (plusMo) mapping[plusMo] = "MONTHLY";
  if (plusYr) mapping[plusYr] = "ANNUAL";

  return mapping;
})();

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Failed to parse checkout session payload", error);
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const validationResult = createCheckoutSessionByPriceSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const { priceId } = validationResult.data;
    const planType = priceIdToPlanTypeMap[priceId];

    if (!planType) {
      console.error("Attempted to create checkout session with unknown price ID", priceId);
      const isDevelopment = process.env.NODE_ENV !== "production";
      return NextResponse.json(
        {
          error: isDevelopment
            ? `Invalid price ID. Please verify that your Stripe price IDs (STRIPE_STANDARD_PRICE_ID_MO/YR, STRIPE_TEAM_PRICE_ID_MO/YR, STRIPE_PLUS_PRICE_ID_MO/YR) are correctly configured in your environment variables.`
            : "This plan is currently unavailable. Please contact support.",
        },
        { status: 400 }
      );
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

    let customerId = user.stripeCustomerId;

    // Check for existing incomplete/expired subscriptions and handle them
    if (user.subscription) {
      const existingStatus = user.subscription.status;
      const existingStripeSubscriptionId = user.subscription.stripeSubscriptionId;

      // If there's an incomplete or incomplete_expired subscription, check if we can retry
      if (existingStatus === "INCOMPLETE" || existingStatus === "INCOMPLETE_EXPIRED") {
        if (existingStripeSubscriptionId) {
          try {
            // Check the actual status in Stripe
            const stripeSubscription = await stripe.subscriptions.retrieve(existingStripeSubscriptionId);
            const stripeStatus = stripeSubscription.status;

            // If it's expired or incomplete in Stripe, we can safely create a new checkout session
            // The webhook will eventually update the database
            if (stripeStatus === "incomplete_expired" || stripeStatus === "incomplete") {
              console.log(`[Checkout] User ${user.id} has existing subscription in database (status: ${existingStatus}, Stripe status: ${stripeStatus}), allowing new checkout attempt`);
            }
          } catch (stripeError: any) {
            // If the subscription doesn't exist in Stripe anymore, we can proceed with new checkout
            if (stripeError.type === "StripeInvalidRequestError" && stripeError.code === "resource_missing") {
              console.log(`[Checkout] Existing subscription ${existingStripeSubscriptionId} not found in Stripe, allowing new checkout attempt`);
            } else {
              // Log but don't block - other errors shouldn't prevent checkout
              console.warn(`[Checkout] Error checking existing subscription: ${stripeError.message}`);
            }
          }
        }
      }

      // Don't allow new checkout if user already has an active or trialing subscription
      if (existingStatus === "ACTIVE" || existingStatus === "TRIALING") {
        const isDevelopment = process.env.NODE_ENV !== "production";
        return NextResponse.json(
          {
            error: isDevelopment
              ? `You already have an ${existingStatus.toLowerCase()} subscription. Manage your subscription in Settings.`
              : "You already have an active subscription. Visit Settings to manage your plan.",
          },
          { status: 400 }
        );
      }
    }

    if (!customerId) {
      try {
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
      } catch (error: any) {
        console.error("Failed to create Stripe customer", {
          userId: user.id,
          email: user.email,
          error: error?.message || error,
        });

        // Provide more detailed error message in development
        const isDevelopment = process.env.NODE_ENV !== "production";
        const errorMessage = isDevelopment
          ? `Unable to create billing profile: ${error?.message || "Unknown error"}. Check your Stripe API key configuration.`
          : "Unable to create billing profile. Please try again or contact support.";

        return NextResponse.json(
          {
            error: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    const now = new Date();
    const trialEligible = !user.hasReceivedFreeTrial;
    const trialPeriodDays = getTrialPeriodDays();
    const trialEnd = trialEligible ? new Date(now.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000) : null;

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
                `3. Update your environment variables with the correct Price IDs.\n` +
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

    logTestModeInfo("Creating checkout session (by price ID)", {
      userId: user.id,
      planType,
      priceId,
      trialEligible,
      trialPeriodDays,
      customerId,
    });

    const subscriptionRecord = await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        customerId,
        stripeCustomerId: customerId,
        planType,
        billingCycle: planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd,
      },
      update: {
        customerId,
        stripeCustomerId: customerId,
        planType,
        billingCycle: planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd,
      },
    });

    const rawBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
    const baseUrl = normalizeBrowserUrl(rawBaseUrl);
    
    const successUrl = `${baseUrl}/dashboard/settings?checkout=success`;
    const cancelUrl = `${baseUrl}/onboarding/plans?checkout=cancelled`;

    const checkoutSessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      metadata: getTestModeMetadata({
        userId: user.id,
        planType,
        subscriptionRecordId: subscriptionRecord.id,
      }),
      subscription_data: {
        metadata: getTestModeMetadata({
          userId: user.id,
          planType,
        }),
      },
      ...getTestModeCheckoutOptions(),
    };

    if (customerId) {
      checkoutSessionParams.customer = customerId;
    } else if (user.email) {
      checkoutSessionParams.customer_email = user.email;
    }

    if (trialEligible) {
      checkoutSessionParams.subscription_data = {
        ...checkoutSessionParams.subscription_data,
        trial_period_days: trialPeriodDays,
      };
    }

    const idempotencyKey = `checkout_${user.id}_${priceId}_${Date.now()}`;

    let checkoutSession: Stripe.Checkout.Session;
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
                `3. Update your environment variables with the correct Price IDs\n\n` +
                `See docs/STRIPE_QUICK_START.md for setup instructions.`
              : "This subscription plan is not currently available. Please contact support for assistance.",
          },
          { status: 400 }
        );
      }

      // Handle errors related to existing incomplete subscriptions
      if (stripeError.message && stripeError.message.toLowerCase().includes("subscription")) {
        const isDevelopment = process.env.NODE_ENV !== "production";
        console.error(`Stripe checkout session creation failed with subscription-related error:`, {
          userId: user.id,
          customerId,
          priceId,
          error: stripeError.message,
        });

        return NextResponse.json(
          {
            error: isDevelopment
              ? `Unable to create checkout session: ${stripeError.message}. You may have an incomplete subscription that expired after 24 hours. Please try again or contact support.`
              : "Unable to create checkout session. Please try again or contact support if the issue persists.",
          },
          { status: 400 }
        );
      }

      // Re-throw other Stripe errors to be handled by the outer catch
      throw stripeError;
    }

    logTestModeInfo("Checkout session created (by price ID)", {
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
    console.error("create-checkout-session.error", error);
    return NextResponse.json(
      {
        error: "Failed to create checkout session",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
