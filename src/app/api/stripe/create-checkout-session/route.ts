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
  const monthly = process.env.STRIPE_MONTHLY_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
  const annual = process.env.STRIPE_ANNUAL_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;

  if (monthly) mapping[monthly] = "MONTHLY";
  if (annual) mapping[annual] = "ANNUAL";

  // New plans
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
            ? `Invalid price ID:. Please verify that NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID and NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID are correctly configured in your environment variables.`
            : "Unsupported price. Please contact support.",
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
    const config = getStripeConfig();

    // Log helpful debugging info in development
    if (process.env.NODE_ENV !== "production") {
      const maskedKey = config.secretKey ? `${config.secretKey.substring(0, 7)}...${config.secretKey.substring(config.secretKey.length - 4)}` : "NOT_SET";
      console.log(`[Stripe Debug] Using secret key: ${maskedKey} (${config.isTestMode ? "test mode" : "live mode"})`);
      
      if (config.secretKey.includes("_your_") || config.secretKey === "sk_test_your_stripe_secret_key") {
        console.warn("[Stripe Debug] WARNING: You are using a placeholder STRIPE_SECRET_KEY. Please update it in your .env file.");
      }
    }

    let customerId = user.stripeCustomerId;

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
      } catch (error) {
        console.error("Failed to create Stripe customer", error);
        return NextResponse.json(
          {
            error: "Unable to create billing profile. Please try again or contact support.",
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
      const isDevelopment = process.env.NODE_ENV !== "production";
      const config = getStripeConfig();
      
      if (priceError.type === "StripeInvalidRequestError" && priceError.code === "resource_missing") {
        console.error(`Stripe price validation failed: ${priceId}`, priceError);

        if (isDevelopment) {
          // In development, we log a warning but allow it to proceed to see if sessions.create works
          // This helps if there are synchronization issues or restricted key permissions
          console.warn(`[Stripe Development] Price ID ${priceId} not found via retrieve(), but proceeding to attempt checkout session creation anyway.`);
        } else {
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
      } else {
        // If it's another error, log it but continue (maybe transient network issue)
        console.warn(`Failed to validate price ${priceId}, continuing anyway:`, priceError);
      }
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
