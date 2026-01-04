import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { getStripe } from "@/lib/stripe";
import { changePlanSchema } from "@/lib/validations/subscription";
import { updateStorageQuotaForPlanChange } from "@/lib/services/storage.service";
import { getStripeConfig } from "@/lib/stripe-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = changePlanSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid request", details: validationResult.error.format() }, { status: 400 });
    }

    const { planType } = validationResult.data;

    // Use the new plan price IDs based on plan type
    const priceId = planType === "MONTHLY" ? process.env.STRIPE_STANDARD_PRICE_ID_MO : process.env.STRIPE_STANDARD_PRICE_ID_YR;

    if (!priceId) {
      console.error(`Missing price ID for plan type: ${planType}`);
      return NextResponse.json({ error: "Subscription plan configuration error. Please contact support." }, { status: 500 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        organizationId: true,
        subscription: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.subscription?.stripeSubscriptionId) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 });
    }

    const stripe = getStripe();

    // Validate that the price exists in Stripe before attempting to change plan
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
              ? `The Stripe price ID "${priceId}" does not exist in your ${config.isTestMode ? 'test' : 'live'} Stripe account.\n\n` +
                `To fix this issue:\n` +
                `1. Go to your Stripe Dashboard: ${config.isTestMode ? 'https://dashboard.stripe.com/test/products' : 'https://dashboard.stripe.com/products'}\n` +
                `2. Create or locate your subscription products and copy the Price IDs\n` +
                `3. Update the environment variables for plan type: ${planType}\n\n` +
                `Currently configured price ID: ${priceId}\n\n` +
                `See docs/STRIPE_QUICK_START.md for detailed setup instructions.`
              : "This subscription plan is not currently available. Please contact support for assistance.",
          },
          { status: 400 }
        );
      }
      // If it's another error, log it but continue (maybe transient network issue)
      console.warn(`Failed to validate price ${priceId}, continuing anyway:`, priceError);
    }

    const currentSubscription = await stripe.subscriptions.retrieve(user.subscription.stripeSubscriptionId);

    if (!currentSubscription.items.data[0]) {
      return NextResponse.json({ error: "Invalid subscription state" }, { status: 400 });
    }

    let updatedSubscription;
    try {
      updatedSubscription = await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
        items: [
          {
            id: currentSubscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: "create_prorations",
      });
    } catch (stripeError: any) {
      // Handle Stripe-specific errors with better messages
      if (stripeError.type === "StripeInvalidRequestError" && stripeError.code === "resource_missing") {
        const isDevelopment = process.env.NODE_ENV !== "production";
        const config = getStripeConfig();
        console.error(`Stripe price not found during subscription update: ${priceId}`, stripeError);
        
        return NextResponse.json(
          {
            error: isDevelopment
              ? `The Stripe price ID "${priceId}" does not exist in your Stripe account. Please verify your Stripe configuration and ensure the price IDs are correctly set in your environment variables.`
              : "This subscription plan is not currently available. Please contact support for assistance.",
          },
          { status: 400 }
        );
      }
      
      // Re-throw other Stripe errors to be handled by the outer catch
      throw stripeError;
    }

    const currentPeriodStart = (updatedSubscription as any).current_period_start;
    const currentPeriodEnd = (updatedSubscription as any).current_period_end;

    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        planType,
        billingCycle: planType,
        priceId,
        currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart * 1000) : null,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Plan changed successfully",
      planType,
    });
  } catch (error: any) {
    console.error("Plan change error:", error);
    return NextResponse.json(
      {
        error: "Failed to change plan",
        message: error?.message ?? "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
