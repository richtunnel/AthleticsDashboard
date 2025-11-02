import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { createCheckoutSessionSchema } from "@/lib/validations/subscription";
import { getTestModeMetadata, logTestModeInfo, getTestModeCheckoutOptions, getTrialPeriodDays, getStripeConfig } from "@/lib/stripe-config";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
        ? (process.env.STRIPE_MONTHLY_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID)
        : (process.env.STRIPE_ANNUAL_PRICE_ID || process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID);

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
                `   - NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID\n` +
                `   - NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID\n\n` +
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

    const subscriptionData = await prisma.subscription.upsert({
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
        trialEnd: trialEligible ? new Date(now.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000) : null,
      },
      update: {
        customerId,
        stripeCustomerId: customerId,
        planType,
        billingCycle: planType,
        priceId,
        status: "INCOMPLETE",
        trialStart: trialEligible ? now : null,
        trialEnd: trialEligible ? new Date(now.getTime() + trialPeriodDays * 24 * 60 * 60 * 1000) : null,
      },
    });

    const checkoutSessionParams: any = {
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.nextUrl.origin}/onboarding/details?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.nextUrl.origin}/onboarding/plans?canceled=true`,
      metadata: getTestModeMetadata({
        userId: user.id,
        planType,
        subscriptionRecordId: subscriptionData.id,
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
                `3. Update NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID and NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID in your environment variables\n\n` +
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
